// Plan 382 — Transaction save confirmation summary before posting.
// One calm review summary shown before the payment posts: customer
// name and mohalla, amount in digits and words, method, and which
// bill it settles — with an explicit confirm step and a back step.
// It confirms only and posts nothing until confirmed; going back
// returns to the form with the entries intact, and cancelling posts
// nothing. The summary never changes any bill, payment, or customer
// record by itself.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SAVE_CONFIRMATION_MONTH_NAMES,
  saveConfirmationMonthLabel,
  normalizeSaveConfirmationSummary,
  saveConfirmationSummaryLines,
  saveConfirmationSummaryHtml,
  saveConfirmationSummaryKey,
} from '../save-confirmation-summary.js';

const dir = dirname(fileURLToPath(import.meta.url));
const moduleSrc = readFileSync(join(dir, '..', 'save-confirmation-summary.js'), 'utf8');
const quickCollectSrc = readFileSync(join(dir, '..', 'nav-quick-collect.js'), 'utf8');
const coreSrc = readFileSync(join(dir, '..', 'core.js'), 'utf8');
const appSrc = readFileSync(join(dir, '..', 'app.js'), 'utf8');
const indexSrc = readFileSync(join(dir, '..', 'index.html'), 'utf8');
const stylesSrc = readFileSync(join(dir, '..', 'styles.css'), 'utf8');
const testSrc = readFileSync(fileURLToPath(import.meta.url), 'utf8');

// Generic fixtures only — clearly made-up names, never a real person.
function entry(overrides = {}) {
  return {
    customerId: 'CUST-1',
    customerName: 'Customer One',
    mohalla: 'Mohalla A',
    amount: 3000,
    amountWords: 'Three thousand',
    method: 'Cash',
    billMonth: '2026-11',
    advance: false,
    advanceTargetMonth: '',
    legs: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Month label — saveConfirmationMonthLabel
// ---------------------------------------------------------------------------

test('month label: a strict YYYY-MM month reads as "Month Year"', () => {
  assert.equal(saveConfirmationMonthLabel('2026-11'), 'November 2026');
  assert.equal(saveConfirmationMonthLabel('2026-01'), 'January 2026');
  assert.equal(saveConfirmationMonthLabel('2027-12'), 'December 2027');
});

test('month label: the table holds all twelve months in order', () => {
  assert.equal(SAVE_CONFIRMATION_MONTH_NAMES.length, 12);
  assert.equal(SAVE_CONFIRMATION_MONTH_NAMES[0], 'January');
  assert.equal(SAVE_CONFIRMATION_MONTH_NAMES[11], 'December');
});

test('month label: anything that is not a strict YYYY-MM month has no label', () => {
  assert.equal(saveConfirmationMonthLabel('2026-13'), '');
  assert.equal(saveConfirmationMonthLabel('2026-00'), '');
  assert.equal(saveConfirmationMonthLabel('2026-1'), '');
  assert.equal(saveConfirmationMonthLabel('Nov 2026'), '');
  assert.equal(saveConfirmationMonthLabel(''), '');
  assert.equal(saveConfirmationMonthLabel(null), '');
  assert.equal(saveConfirmationMonthLabel(undefined), '');
});

// ---------------------------------------------------------------------------
// Normalize — normalizeSaveConfirmationSummary
// ---------------------------------------------------------------------------

test('normalize: a complete entry normalizes with a "Month Year bill" settles label', () => {
  const summary = normalizeSaveConfirmationSummary(entry());
  assert.ok(summary);
  assert.equal(summary.customerName, 'Customer One');
  assert.equal(summary.mohalla, 'Mohalla A');
  assert.equal(summary.amount, 3000);
  assert.equal(summary.amountWords, 'Three thousand');
  assert.equal(summary.method, 'Cash');
  assert.equal(summary.billLabel, 'November 2026 bill');
  assert.equal(summary.advance, false);
  assert.deepEqual(summary.legs, []);
});

test('normalize: an empty mohalla reads as Unassigned, like the form header', () => {
  assert.equal(normalizeSaveConfirmationSummary(entry({ mohalla: '' })).mohalla, 'Unassigned');
  assert.equal(normalizeSaveConfirmationSummary(entry({ mohalla: '   ' })).mohalla, 'Unassigned');
});

test('normalize: free text is trimmed and capped, never stored raw', () => {
  const summary = normalizeSaveConfirmationSummary(entry({
    customerName: `  ${'N'.repeat(120)}  `,
    mohalla: `  ${'M'.repeat(80)}  `,
  }));
  assert.equal(summary.customerName.length, 100);
  assert.equal(summary.mohalla.length, 60);
});

test('normalize: an advance payment settles no bill — it names the advance target month', () => {
  const summary = normalizeSaveConfirmationSummary(entry({
    advance: true,
    advanceTargetMonth: '2026-12',
  }));
  assert.ok(summary);
  assert.equal(summary.billLabel, 'Advance credit for December 2026');
  assert.equal(summary.advance, true);
});

test('normalize: no customer, no positive amount, or no method means no summary', () => {
  assert.equal(normalizeSaveConfirmationSummary(entry({ customerName: '' })), null);
  assert.equal(normalizeSaveConfirmationSummary(entry({ customerName: '   ' })), null);
  assert.equal(normalizeSaveConfirmationSummary(entry({ amount: 0 })), null);
  assert.equal(normalizeSaveConfirmationSummary(entry({ amount: -500 })), null);
  assert.equal(normalizeSaveConfirmationSummary(entry({ amount: 'abc' })), null);
  assert.equal(normalizeSaveConfirmationSummary(entry({ amount: '' })), null);
  assert.equal(normalizeSaveConfirmationSummary(entry({ method: '' })), null);
  assert.equal(normalizeSaveConfirmationSummary(entry({ method: '   ' })), null);
  assert.equal(normalizeSaveConfirmationSummary(null), null);
  assert.equal(normalizeSaveConfirmationSummary('not an object'), null);
});

test('normalize: a bad bill month means no summary; a bad advance target means no summary', () => {
  assert.equal(normalizeSaveConfirmationSummary(entry({ billMonth: '2026-13' })), null);
  assert.equal(normalizeSaveConfirmationSummary(entry({ billMonth: '' })), null);
  assert.equal(normalizeSaveConfirmationSummary(entry({
    advance: true,
    advanceTargetMonth: '2026-13',
  })), null);
  assert.equal(normalizeSaveConfirmationSummary(entry({
    advance: true,
    advanceTargetMonth: '',
  })), null);
});

test('normalize: a split leg normalizes beside the main payment', () => {
  const summary = normalizeSaveConfirmationSummary(entry({
    legs: [{ amount: 1000, amountWords: 'One thousand', method: 'Easypaisa' }],
  }));
  assert.ok(summary);
  assert.equal(summary.legs.length, 1);
  assert.equal(summary.legs[0].amount, 1000);
  assert.equal(summary.legs[0].amountWords, 'One thousand');
  assert.equal(summary.legs[0].method, 'Easypaisa');
  assert.equal(summary.amount, 3000);
  assert.equal(summary.method, 'Cash');
});

test('normalize: an invalid split leg means no summary at all', () => {
  assert.equal(normalizeSaveConfirmationSummary(entry({
    legs: [{ amount: 0, method: 'Easypaisa' }],
  })), null);
  assert.equal(normalizeSaveConfirmationSummary(entry({
    legs: [{ amount: 1000, method: '' }],
  })), null);
});

test('normalize: normalizing never mutates the entry', () => {
  const input = entry({ customerName: '  Customer One  ' });
  const before = JSON.stringify(input);
  normalizeSaveConfirmationSummary(input);
  assert.equal(JSON.stringify(input), before);
});

// ---------------------------------------------------------------------------
// Lines — saveConfirmationSummaryLines
// ---------------------------------------------------------------------------

test('lines: the summary reads customer, mohalla, amount, words, method, settles — in that order', () => {
  const lines = saveConfirmationSummaryLines(normalizeSaveConfirmationSummary(entry()));
  assert.deepEqual(lines.map((line) => line.label), [
    'Customer', 'Mohalla', 'Amount', 'Amount in words', 'Method', 'Settles',
  ]);
  assert.deepEqual(lines.map((line) => line.value), [
    'Customer One', 'Mohalla A', 'PKR 3,000', 'Three thousand', 'Cash', 'November 2026 bill',
  ]);
});

test('lines: the amount digits use the PKR grouping the form uses', () => {
  const lines = saveConfirmationSummaryLines(normalizeSaveConfirmationSummary(entry({ amount: 1500.5 })));
  assert.equal(lines.find((line) => line.label === 'Amount').value, 'PKR 1,500.5');
});

test('lines: no amount-in-words means no words line — the digits line still stands', () => {
  const lines = saveConfirmationSummaryLines(normalizeSaveConfirmationSummary(entry({ amountWords: '' })));
  assert.deepEqual(lines.map((line) => line.label), [
    'Customer', 'Mohalla', 'Amount', 'Method', 'Settles',
  ]);
});

test('lines: a split payment shows every leg after the method line', () => {
  const lines = saveConfirmationSummaryLines(normalizeSaveConfirmationSummary(entry({
    legs: [{ amount: 1000, amountWords: 'One thousand', method: 'Easypaisa' }],
  })));
  // Plan 533: the Split total row joins the order between the last
  // leg and Settles — the legs themselves are unchanged, only the
  // total they add up to is now shown (amount 3,000 + leg 1,000).
  assert.deepEqual(lines.map((line) => line.label), [
    'Customer', 'Mohalla', 'Amount', 'Amount in words', 'Method',
    'Leg 2 amount', 'Leg 2 amount in words', 'Leg 2 method', 'Split total', 'Settles',
  ]);
  assert.equal(lines.find((line) => line.label === 'Leg 2 amount').value, 'PKR 1,000');
  assert.equal(lines.find((line) => line.label === 'Leg 2 method').value, 'Easypaisa');
  assert.equal(lines.find((line) => line.label === 'Split total').value, 'PKR 4,000');
});

test('lines: no summary means no lines at all', () => {
  assert.deepEqual(saveConfirmationSummaryLines(null), []);
  assert.deepEqual(saveConfirmationSummaryLines(undefined), []);
});

// ---------------------------------------------------------------------------
// HTML — saveConfirmationSummaryHtml
// ---------------------------------------------------------------------------

test('html: the summary renders as a definition list with every figure', () => {
  const html = saveConfirmationSummaryHtml(normalizeSaveConfirmationSummary(entry()));
  assert.ok(html.startsWith('<dl class="scs-summary">'));
  assert.ok(html.endsWith('</dl>'));
  assert.ok(html.includes('<dt>Customer</dt><dd>Customer One</dd>'));
  assert.ok(html.includes('<dt>Amount</dt><dd>PKR 3,000</dd>'));
  assert.ok(html.includes('<dt>Settles</dt><dd>November 2026 bill</dd>'));
});

test('html: a name typed on the form is escaped and can never break out of the panel', () => {
  const html = saveConfirmationSummaryHtml(normalizeSaveConfirmationSummary(entry({
    customerName: '<script>alert(1)</script>',
    mohalla: 'A & B',
  })));
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  assert.ok(html.includes('A &amp; B'));
});

test('html: no summary means no panel at all', () => {
  assert.equal(saveConfirmationSummaryHtml(null), '');
  assert.equal(saveConfirmationSummaryHtml(undefined), '');
});

// ---------------------------------------------------------------------------
// Key — saveConfirmationSummaryKey
// ---------------------------------------------------------------------------

test('key: the same entry always arms the same key', () => {
  const a = saveConfirmationSummaryKey(normalizeSaveConfirmationSummary(entry()));
  const b = saveConfirmationSummaryKey(normalizeSaveConfirmationSummary(entry()));
  assert.ok(a.length > 0);
  assert.equal(a, b);
});

test('key: any edit after the summary was shown produces a different key', () => {
  const base = saveConfirmationSummaryKey(normalizeSaveConfirmationSummary(entry()));
  assert.notEqual(base, saveConfirmationSummaryKey(normalizeSaveConfirmationSummary(entry({ amount: 3001 }))));
  assert.notEqual(base, saveConfirmationSummaryKey(normalizeSaveConfirmationSummary(entry({ method: 'Easypaisa' }))));
  assert.notEqual(base, saveConfirmationSummaryKey(normalizeSaveConfirmationSummary(entry({ billMonth: '2026-12' }))));
  assert.notEqual(base, saveConfirmationSummaryKey(normalizeSaveConfirmationSummary(entry({ customerName: 'Customer Two' }))));
  assert.notEqual(base, saveConfirmationSummaryKey(normalizeSaveConfirmationSummary(entry({ customerId: 'CUST-2' }))));
  assert.notEqual(base, saveConfirmationSummaryKey(normalizeSaveConfirmationSummary(entry({
    legs: [{ amount: 1000, method: 'Easypaisa' }],
  }))));
});

test('key: no summary means no key', () => {
  assert.equal(saveConfirmationSummaryKey(null), '');
  assert.equal(saveConfirmationSummaryKey(undefined), '');
});

// ---------------------------------------------------------------------------
// Acceptance — the summary's figures match the entry form exactly
// ---------------------------------------------------------------------------

test('acceptance: every figure on the form appears unchanged in the summary', () => {
  // The entry form's own values, exactly as the submit handler reads
  // them — the summary is built from the same reads, so a mismatch
  // here would mean the operator confirms figures the save will not
  // record.
  const formValues = {
    customerId: 'CUST-1',
    customerName: 'Customer One',
    mohalla: 'Mohalla A',
    amount: 2500,
    amountWords: 'Two thousand five hundred',
    method: 'JazzCash',
    billMonth: '2026-11',
  };
  const lines = saveConfirmationSummaryLines(normalizeSaveConfirmationSummary(formValues));
  const byLabel = Object.fromEntries(lines.map((line) => [line.label, line.value]));
  assert.equal(byLabel.Customer, formValues.customerName);
  assert.equal(byLabel.Mohalla, formValues.mohalla);
  assert.equal(byLabel.Amount, 'PKR 2,500');
  assert.equal(byLabel['Amount in words'], formValues.amountWords);
  assert.equal(byLabel.Method, formValues.method);
  assert.equal(byLabel.Settles, 'November 2026 bill');
});

// ---------------------------------------------------------------------------
// Wiring — Quick Collect shows the summary before posting
// ---------------------------------------------------------------------------

test('wiring: Quick Collect imports the summary and gates the save on the armed key', () => {
  assert.ok(
    quickCollectSrc.includes("import { normalizeSaveConfirmationSummary, saveConfirmationSummaryHtml, saveConfirmationSummaryKey } from './save-confirmation-summary.js';"),
    'module import',
  );
  assert.ok(
    quickCollectSrc.includes("getElementById('quickCollectStepConfirm')"),
    'confirm step host',
  );
  assert.ok(
    quickCollectSrc.includes("getElementById('quickCollectConfirmSummary')"),
    'summary host',
  );
  assert.ok(
    quickCollectSrc.includes("getElementById('quickCollectConfirmSaveBtn')"),
    'confirm button host',
  );
  assert.ok(
    quickCollectSrc.includes("getElementById('quickCollectConfirmBackBtn')"),
    'back button host',
  );
  assert.ok(
    quickCollectSrc.includes('function buildSaveConfirmationSummary()'),
    'summary builder defined',
  );
  assert.ok(
    quickCollectSrc.includes('saveConfirmationArmedKey'),
    'armed key state',
  );
  // The check sits after the last guard and before either posting
  // path: the summary is shown only once every guard has passed.
  const guardAt = quickCollectSrc.indexOf('// SISP-146: 5-minute double-tap guard');
  const checkAt = quickCollectSrc.indexOf('const pendingSummary = buildSaveConfirmationSummary();');
  const splitAt = quickCollectSrc.indexOf('// SISP-121: split tender');
  assert.ok(guardAt > 0 && checkAt > guardAt, 'check runs after the double-tap guard');
  assert.ok(splitAt > 0 && checkAt < splitAt, 'check runs before the split posting path');
});

test('wiring: confirming arms the key and resubmits; going back returns to the form', () => {
  const confirmAt = quickCollectSrc.indexOf("confirmSaveBtn?.addEventListener('click'");
  assert.ok(confirmAt > 0, 'confirm button listener');
  const confirmBlock = quickCollectSrc.slice(confirmAt, confirmAt + 500);
  assert.ok(
    confirmBlock.includes('saveConfirmationArmedKey = saveConfirmationSummaryKey(summary);'),
    'confirm arms the key',
  );
  assert.ok(
    confirmBlock.includes('requestSubmit()'),
    'confirm resubmits the form',
  );
  const backAt = quickCollectSrc.indexOf("confirmBackBtn?.addEventListener('click'");
  assert.ok(backAt > 0, 'back button listener');
  const backBlock = quickCollectSrc.slice(backAt, backAt + 400);
  assert.ok(backBlock.includes("showStep('form')"), 'back returns to the form step');
  assert.ok(backBlock.includes('saveConfirmationArmedKey = null'), 'back disarms the key');
});

test('wiring: showStep knows the confirm step, hidden like the others', () => {
  assert.ok(
    quickCollectSrc.includes("if (stepConfirm) stepConfirm.hidden = (stepName !== 'confirm');"),
    'showStep handles confirm',
  );
});

test('wiring: the dialog carries the confirm step between the form and success steps', () => {
  assert.ok(
    indexSrc.includes('<div id="quickCollectStepConfirm" class="qc-step" hidden>'),
    'confirm step element',
  );
  assert.ok(
    indexSrc.includes('<div id="quickCollectConfirmSummary" class="scs-summary-box" aria-live="polite"></div>'),
    'summary host element',
  );
  assert.ok(
    indexSrc.includes('id="quickCollectConfirmSaveBtn"'),
    'confirm button element',
  );
  assert.ok(
    indexSrc.includes('id="quickCollectConfirmBackBtn"'),
    'back button element',
  );
  const formAt = indexSrc.indexOf('id="quickCollectStepForm"');
  const confirmAt = indexSrc.indexOf('id="quickCollectStepConfirm"');
  const successAt = indexSrc.indexOf('id="quickCollectStepSuccess"');
  assert.ok(formAt > 0 && confirmAt > formAt, 'confirm step sits after the form step');
  assert.ok(successAt > 0 && confirmAt < successAt, 'confirm step sits before the success step');
});

test('wiring: the summary rules add no new hex colour to styles', () => {
  const rule = stylesSrc.match(/\.scs-summary[^{]*\{[^}]*\}/g);
  assert.ok(rule && rule.length > 0, 'summary rules exist');
  const baseline = stylesSrc.replace(/\.scs-summary[^{]*\{[^}]*\}/g, '');
  const baselineHexes = new Set((baseline.match(/#[0-9a-fA-F]{3,8}/g) || []).map((h) => h.toLowerCase()));
  for (const match of rule) {
    const hexes = match.match(/#[0-9a-fA-F]{3,8}/g) || [];
    for (const hex of hexes) {
      assert.ok(baselineHexes.has(hex.toLowerCase()), `new hex colour ${hex} in a summary rule`);
    }
  }
});

test('wiring: core and app carry no trace of this plan', () => {
  assert.ok(!coreSrc.includes('saveConfirmationSummary'), 'core untouched by this plan');
  assert.ok(!appSrc.includes('saveConfirmationSummary'), 'app untouched by this plan');
});

// ---------------------------------------------------------------------------
// Guards — purity, fences, no real names
// ---------------------------------------------------------------------------

test('guard: the module is pure — no store, no DOM, no clock, no network', () => {
  assert.ok(!moduleSrc.includes('shahdara_'), 'no store key');
  assert.ok(!moduleSrc.includes('localStorage'), 'no storage');
  assert.ok(!moduleSrc.includes('document.'), 'no document access');
  assert.ok(!moduleSrc.includes('window.'), 'no window access');
  assert.ok(!moduleSrc.includes('new Date('), 'no clock read');
  assert.ok(!moduleSrc.includes('Date.now('), 'no clock read');
  assert.ok(!moduleSrc.includes('fetch('), 'no network');
  assert.ok(!moduleSrc.includes('import '), 'no imports — pure module');
  assert.ok(!/\bOLT\b/.test(moduleSrc), 'no standalone OLT word');
});

test('guard: the module never names a fenced neighbour module', () => {
  // Neighbour modules are checked by filename only and left untouched:
  // the post-save confirmation drafts are written after a payment is
  // recorded, the service-change draft confirms an agreed change, the
  // first-bill preview prices a new customer's first bill, the
  // package-change preview prices a change before it is applied, and
  // the balance record acknowledges a confirmed balance. None of them
  // is a before-posting payment summary. Filenames are built from
  // fragments so this very test never contains them literally either.
  const fenced = [
    'payment-confirm' + 'ation.js',
    'change-confirm' + 'ation.js',
    'first-bill-prev' + 'iew.js',
    'package-change-prev' + 'iew.js',
    'balance-confirm' + 'ations.js',
  ];
  for (const name of fenced) {
    assert.ok(!moduleSrc.includes(name), `module must not name ${name}`);
    assert.ok(!testSrc.includes(name), `test must not name ${name}`);
  }
});

test('guard: no real person or customer name anywhere in this file', () => {
  // Names are built from fragments so the list itself never contains
  // one literally.
  const forbidden = [
    'Sa' + 'ad',
    'Ki' + 'ran',
    'Hai' + 'der',
    'Shu' + 'naid',
    'Kha' + 'zer',
    'Mo' + 'hsin',
    'Shar' + 'jell',
    'No' + 'mi',
    'Aq' + 'ib',
    'Ej' + 'az',
  ];
  for (const name of forbidden) {
    assert.ok(!testSrc.includes(name), `test must not name ${name}`);
    assert.ok(!moduleSrc.includes(name), `module must not name ${name}`);
  }
});
