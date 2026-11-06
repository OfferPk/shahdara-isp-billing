// Plan 381 — Transaction next receipt number shown before saving.
// One preview on the transaction entry form: the number this payment
// will receive, shown before saving. It previews only and issues no
// number until the save; previewing never changes any bill, payment,
// or per-collector series record (Plan 122).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  nextReceiptNumber,
  nextReceiptNumberFor,
  nextReceiptNumberLineText,
} from '../next-receipt-number.js';

const dir = dirname(fileURLToPath(import.meta.url));
const moduleSrc = readFileSync(join(dir, '..', 'next-receipt-number.js'), 'utf8');
const quickCollectSrc = readFileSync(join(dir, '..', 'nav-quick-collect.js'), 'utf8');
const coreSrc = readFileSync(join(dir, '..', 'core.js'), 'utf8');
const appSrc = readFileSync(join(dir, '..', 'app.js'), 'utf8');
const indexSrc = readFileSync(join(dir, '..', 'index.html'), 'utf8');
const stylesSrc = readFileSync(join(dir, '..', 'styles.css'), 'utf8');
const testSrc = readFileSync(fileURLToPath(import.meta.url), 'utf8');

// Generic fixtures only — clearly made-up names, never a real person.
function payment(id, date, amount, extra = {}) {
  return { id, date, amount, method: 'Cash', ...extra };
}

function customer(number, bills = []) {
  return { id: 'CUST-1', customerNumber: number, name: 'Customer One', bills };
}

function bill(month, payments = []) {
  return { id: `B-${month}`, month, dueAmount: 3000, status: 'pending', payments };
}

// The save-time number template, exactly as the Quick Collect save
// computes it (nav-quick-collect.js, executeQuickCollection): the
// bill's payment count AFTER the new payment lands. Replicated here,
// not imported, so a change to the save formula fails this test
// instead of silently following it.
function issuedOnSave(customerNumber, month, postSaveCount) {
  return `RCPT-${customerNumber}-${month.replace('-', '')}-${String(postSaveCount || 1).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// Builder — nextReceiptNumber
// ---------------------------------------------------------------------------

test('builder: first payment on a bill previews -01', () => {
  assert.equal(nextReceiptNumber(41, '2026-11', 0), 'RCPT-41-202611-01');
});

test('builder: third payment on a bill previews -03', () => {
  assert.equal(nextReceiptNumber(41, '2026-11', 2), 'RCPT-41-202611-03');
});

test('builder: sequence pads to two digits, then grows past them', () => {
  assert.equal(nextReceiptNumber(41, '2026-11', 9), 'RCPT-41-202611-10');
  assert.equal(nextReceiptNumber(41, '2026-11', 99), 'RCPT-41-202611-100');
});

test('builder: the month compacts to YYYYMM', () => {
  assert.equal(nextReceiptNumber(41, '2026-01', 0), 'RCPT-41-202601-01');
  assert.equal(nextReceiptNumber(7, '2026-12', 0), 'RCPT-7-202612-01');
});

test('builder: a month that is not strict YYYY-MM has no preview', () => {
  assert.equal(nextReceiptNumber(41, '', 0), '');
  assert.equal(nextReceiptNumber(41, '2026-13', 0), '');
  assert.equal(nextReceiptNumber(41, '2026-00', 0), '');
  assert.equal(nextReceiptNumber(41, '2026-1', 0), '');
  assert.equal(nextReceiptNumber(41, '2026/11', 0), '');
  assert.equal(nextReceiptNumber(41, 'Nov 2026', 0), '');
  assert.equal(nextReceiptNumber(41, undefined, 0), '');
});

test('builder: no customer number means no preview', () => {
  assert.equal(nextReceiptNumber(undefined, '2026-11', 0), '');
  assert.equal(nextReceiptNumber('', '2026-11', 0), '');
  assert.equal(nextReceiptNumber(0, '2026-11', 0), '');
  assert.equal(nextReceiptNumber(null, '2026-11', 0), '');
});

test('builder: a negative or non-integer customer number has no preview', () => {
  assert.equal(nextReceiptNumber(-41, '2026-11', 0), '');
  assert.equal(nextReceiptNumber(41.5, '2026-11', 0), '');
  assert.equal(nextReceiptNumber('CUST-41', '2026-11', 0), '');
});

test('builder: a digits-only string number prints exactly as given', () => {
  assert.equal(nextReceiptNumber('41', '2026-11', 0), 'RCPT-41-202611-01');
  assert.equal(nextReceiptNumber('041', '2026-11', 0), 'RCPT-041-202611-01');
});

test('builder: a count that is not a non-negative integer has no preview', () => {
  assert.equal(nextReceiptNumber(41, '2026-11', -1), '');
  assert.equal(nextReceiptNumber(41, '2026-11', 1.5), '');
  assert.equal(nextReceiptNumber(41, '2026-11', Number.NaN), '');
  assert.equal(nextReceiptNumber(41, '2026-11', '2'), '');
  assert.equal(nextReceiptNumber(41, '2026-11', undefined), '');
});

// ---------------------------------------------------------------------------
// Record-derived preview — nextReceiptNumberFor
// ---------------------------------------------------------------------------

test('record: a bill with two payments previews -03', () => {
  const c = customer(41, [bill('2026-11', [payment('P-1', '2026-11-01', 1000), payment('P-2', '2026-11-03', 1000)])]);
  assert.equal(nextReceiptNumberFor(c, '2026-11'), 'RCPT-41-202611-03');
});

test('record: a bill with no payments array previews -01', () => {
  const c = customer(41, [{ id: 'B-2026-11', month: '2026-11', dueAmount: 3000, status: 'pending' }]);
  assert.equal(nextReceiptNumberFor(c, '2026-11'), 'RCPT-41-202611-01');
});

test('record: a month with no bill previews -01', () => {
  const c = customer(41, [bill('2026-10', [payment('P-1', '2026-10-01', 1000)])]);
  assert.equal(nextReceiptNumberFor(c, '2026-11'), 'RCPT-41-202611-01');
});

test('record: a customer with no bills previews -01', () => {
  assert.equal(nextReceiptNumberFor(customer(41, []), '2026-11'), 'RCPT-41-202611-01');
  assert.equal(nextReceiptNumberFor({ id: 'CUST-1', customerNumber: 41 }, '2026-11'), 'RCPT-41-202611-01');
});

test('record: no customer, or a bad month, has no preview', () => {
  assert.equal(nextReceiptNumberFor(null, '2026-11'), '');
  assert.equal(nextReceiptNumberFor(undefined, '2026-11'), '');
  assert.equal(nextReceiptNumberFor(customer(41, [bill('2026-11', [])]), '2026-13'), '');
});

test('record: a voided payment still occupies its sequence slot', () => {
  // The save counts every payment in the bill array — voided or not —
  // so the preview must count the same array, or it would drift.
  const c = customer(41, [bill('2026-11', [
    payment('P-1', '2026-11-01', 1000),
    payment('P-2', '2026-11-03', 1000, { voided: true }),
  ])]);
  assert.equal(nextReceiptNumberFor(c, '2026-11'), 'RCPT-41-202611-03');
});

test('record: previewing counts only the target month', () => {
  const c = customer(41, [
    bill('2026-10', [payment('P-1', '2026-10-01', 1000), payment('P-2', '2026-10-05', 1000), payment('P-3', '2026-10-09', 1000)]),
    bill('2026-11', [payment('P-4', '2026-11-01', 1000)]),
  ]);
  assert.equal(nextReceiptNumberFor(c, '2026-11'), 'RCPT-41-202611-02');
  assert.equal(nextReceiptNumberFor(c, '2026-10'), 'RCPT-41-202610-04');
});

test('record: previewing never mutates the customer record', () => {
  const c = customer(41, [bill('2026-11', [payment('P-1', '2026-11-01', 1000)])]);
  const before = JSON.stringify(c);
  nextReceiptNumberFor(c, '2026-11');
  nextReceiptNumberLineText(c, '2026-11');
  assert.equal(JSON.stringify(c), before);
});

// ---------------------------------------------------------------------------
// Preview line — nextReceiptNumberLineText
// ---------------------------------------------------------------------------

test('line: the preview line names the number plainly', () => {
  const c = customer(41, [bill('2026-11', [payment('P-1', '2026-11-01', 1000), payment('P-2', '2026-11-03', 1000)])]);
  assert.equal(nextReceiptNumberLineText(c, '2026-11'), 'Next receipt: RCPT-41-202611-03');
});

test('line: no number means no line at all', () => {
  assert.equal(nextReceiptNumberLineText(null, '2026-11'), '');
  assert.equal(nextReceiptNumberLineText(customer(41, []), '2026-13'), '');
  assert.equal(nextReceiptNumberLineText({ id: 'CUST-1' }, '2026-11'), '');
});

// ---------------------------------------------------------------------------
// Acceptance — the previewed number matches the number issued on save
// ---------------------------------------------------------------------------

test('acceptance: preview matches the issued number — first payment', () => {
  const c = customer(41, [bill('2026-11', [])]);
  const preview = nextReceiptNumberFor(c, '2026-11');
  assert.equal(preview, issuedOnSave(41, '2026-11', 0 + 1));
});

test('acceptance: preview matches the issued number — third payment', () => {
  const c = customer(41, [bill('2026-11', [payment('P-1', '2026-11-01', 1000), payment('P-2', '2026-11-03', 1000)])]);
  const preview = nextReceiptNumberFor(c, '2026-11');
  assert.equal(preview, issuedOnSave(41, '2026-11', 2 + 1));
});

test('acceptance: preview matches the issued number — tenth payment', () => {
  const payments = Array.from({ length: 9 }, (_, i) => payment(`P-${i + 1}`, `2026-11-0${(i % 9) + 1}`, 1000));
  const c = customer(41, [bill('2026-11', payments)]);
  const preview = nextReceiptNumberFor(c, '2026-11');
  assert.equal(preview, issuedOnSave(41, '2026-11', 9 + 1));
});

test('acceptance: preview matches the issued number — month with no bill yet', () => {
  const c = customer(41, [bill('2026-10', [payment('P-1', '2026-10-01', 1000)])]);
  const preview = nextReceiptNumberFor(c, '2026-11');
  assert.equal(preview, issuedOnSave(41, '2026-11', 0 + 1));
});

test('acceptance: previewing never reserves or consumes a number', () => {
  const c = customer(41, [bill('2026-11', [payment('P-1', '2026-11-01', 1000)])]);
  const before = JSON.stringify(c);
  const first = nextReceiptNumberFor(c, '2026-11');
  const second = nextReceiptNumberFor(c, '2026-11');
  const third = nextReceiptNumberLineText(c, '2026-11');
  assert.equal(first, 'RCPT-41-202611-02');
  assert.equal(second, first);
  assert.equal(third, `Next receipt: ${first}`);
  assert.equal(JSON.stringify(c), before);
  for (const p of c.bills[0].payments) {
    assert.equal(p.receiptNumber, undefined);
  }
});

// ---------------------------------------------------------------------------
// Wiring — the preview line lives on the transaction entry form
// ---------------------------------------------------------------------------

test('wiring: Quick Collect imports the preview and renders it on open and on month change', () => {
  assert.ok(
    quickCollectSrc.includes("import { nextReceiptNumberLineText } from './next-receipt-number.js';"),
    'module import',
  );
  assert.ok(
    quickCollectSrc.includes("getElementById('quickCollectNextReceiptLine')"),
    'preview line host',
  );
  const calls = (quickCollectSrc.match(/renderNextReceiptLine\(\);/g) || []).length;
  assert.equal(calls, 2, `renderNextReceiptLine called twice (form open + month change), found ${calls}`);
  assert.ok(
    quickCollectSrc.includes('function renderNextReceiptLine()'),
    'render function defined',
  );
});

test('wiring: the form carries the preview line after the words line', () => {
  assert.ok(
    indexSrc.includes('<p id="quickCollectNextReceiptLine" class="nrn-preview-line" hidden></p>'),
    'preview line element',
  );
  const wordsAt = indexSrc.indexOf('id="quickCollectAmountWordsLine"');
  const previewAt = indexSrc.indexOf('id="quickCollectNextReceiptLine"');
  assert.ok(wordsAt > 0 && previewAt > wordsAt, 'preview line sits after the words line');
});

test('wiring: the preview rule adds no new hex colour to styles', () => {
  const rule = stylesSrc.match(/\.nrn-preview-line[^{]*\{[^}]*\}/);
  assert.ok(rule, 'preview rule exists');
  const baseline = stylesSrc.replace(/\.nrn-preview-line[^{]*\{[^}]*\}/g, '');
  const baselineHexes = new Set((baseline.match(/#[0-9a-fA-F]{3,8}/g) || []).map((h) => h.toLowerCase()));
  const hexes = rule[0].match(/#[0-9a-fA-F]{3,8}/g) || [];
  for (const hex of hexes) {
    assert.ok(baselineHexes.has(hex.toLowerCase()), `new hex colour ${hex} in the preview rule`);
  }
});

test('wiring: core and app carry no trace of this plan', () => {
  assert.ok(!coreSrc.includes('nextReceiptNumber'), 'core untouched by this plan');
  assert.ok(!appSrc.includes('nextReceiptNumber'), 'app untouched by this plan');
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
  // the per-collector series record (Plan 122) assigns ranges only
  // and never numbers a payment, and the receipt builder's fallback
  // number helper numbers a receipt only when no number was stored.
  // This plan previews the save-time number and must not re-implement
  // either. Filenames are built from fragments so this very test
  // never contains them literally either.
  const fenced = [
    'receipt-ser' + 'ies.js',
    'receipt' + '.js',
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
