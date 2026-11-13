// Plan 527 — Next-receipt line hides while a split is on.
// The next-receipt line (Plan 381) names the single number the
// payment will receive. A split payment issues TWO receipt numbers,
// so quoting the leg-1 number as "your receipt number" would be a
// promise the save cannot keep — the receipt preview (Plan 433)
// already previews nothing for a split. This plan applies the same
// condition to the line: hidden while the split toggle is checked,
// shown again when it is unticked. Label/visibility only — no
// change to receipt numbering, no change to the split flow, no
// change to any figure. QC Modal Overhaul 2: the line is folded
// into the one-line form subtitle (renderFormSubtitle, in the
// prefill host) — the gate survives as "the receipt part drops
// while split is on, the bill part stays", and every renderNextReceiptLine
// call site becomes a renderFormSubtitle call.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { nextReceiptNumberLineText } from '../next-receipt-number.js';

const dir = dirname(fileURLToPath(import.meta.url));
const quickCollectSrc = readFileSync(join(dir, '..', 'nav-quick-collect.js'), 'utf8');
const moduleSrc = readFileSync(join(dir, '..', 'next-receipt-number.js'), 'utf8');
const testSrc = readFileSync(fileURLToPath(import.meta.url), 'utf8');

// Generic fixtures only — clearly made-up names, never a real person.
function customer(number, bills = []) {
  return { id: 'CUST-1', customerNumber: number, name: 'Customer One', bills };
}

function bill(month, payments = []) {
  return { id: `B-${month}`, month, dueAmount: 3000, status: 'pending', payments };
}

function payment(id, date, amount) {
  return { id, date, amount, method: 'Cash' };
}

// ---------------------------------------------------------------------------
// Gate — the line hides while the split toggle is checked
// ---------------------------------------------------------------------------

test('gate: the next-receipt part drops from the subtitle while split is on', () => {
  // QC Modal Overhaul 2: the line is folded into renderFormSubtitle
  // — while split is on, the receipt part drops (the bill part
  // stays), so no single receipt number is ever quoted for a split.
  assert.ok(
    quickCollectSrc.includes("const receipt = !splitToggle?.checked ? nextReceiptNumberFor(customer, month) : '';"),
    'renderFormSubtitle drops the receipt part while split is on',
  );
  assert.ok(
    !quickCollectSrc.includes("const receipt = nextReceiptNumberFor(customer, month);"),
    'the un-gated receipt is gone',
  );
  assert.ok(
    quickCollectSrc.includes("prefillLine.textContent = receipt ? `${billPart} · Next: ${receipt}` : billPart;"),
    'split off shows the receipt part, split on shows the bill part only',
  );
});

test('gate: the line still names the number when split is off', () => {
  // The figure itself is the Plan 381 pure module, untouched by
  // this plan — the gate lives in the wiring file only.
  const c = customer(41, [bill('2026-11', [payment('P-1', '2026-11-01', 1000), payment('P-2', '2026-11-03', 1000)])]);
  assert.equal(nextReceiptNumberLineText(c, '2026-11'), 'Next receipt: RCPT-41-202611-03');
});

// ---------------------------------------------------------------------------
// Wiring — ticking/unticking the split re-renders the line
// ---------------------------------------------------------------------------

test('wiring: the split toggle change re-renders the subtitle', () => {
  assert.ok(
    quickCollectSrc.includes("splitToggle?.addEventListener('change', () => renderFormSubtitle());"),
    'split change listener',
  );
  const listeners = (quickCollectSrc.match(/splitToggle\?\.addEventListener\('change'/g) || []).length;
  assert.equal(listeners, 5, `five split change listeners (visibility + overpayment + underpayment + cash change + subtitle), found ${listeners}`);
});

test('wiring: the subtitle is re-rendered after the split reset on open', () => {
  // The open path renders the subtitle near the top, then resets the
  // split toggle OFF without a change event — and closing never
  // resets the toggle, so the top render can run while the toggle
  // still holds the previous opening's checked state. Without this
  // re-render the receipt part would stay dropped on a fresh sheet
  // although split is off.
  const resetAt = quickCollectSrc.indexOf('SISP-121: split always starts OFF');
  assert.ok(resetAt > 0, 'split reset block exists');
  const afterReset = quickCollectSrc.slice(resetAt, resetAt + 1200);
  assert.ok(
    afterReset.includes('updateSplitVisibility();'),
    'reset runs the visibility update',
  );
  assert.ok(
    afterReset.indexOf('renderFormSubtitle(options);') > afterReset.indexOf('updateSplitVisibility();'),
    'subtitle re-renders after the reset',
  );
});

test('wiring: the render is called at open, on month change, and after the reset', () => {
  // QC Modal Overhaul 2: renderNextReceiptLine is gone — its four
  // call sites are renderFormSubtitle calls now (split toggle change
  // + split change listener + month change + post-reset re-render).
  const calls = (quickCollectSrc.match(/renderFormSubtitle\(/g) || []).length;
  assert.equal(calls, 5, `one definition + four calls (split change + listener + month change + post-reset), found ${calls}`);
  assert.ok(!quickCollectSrc.includes('renderNextReceiptLine('), 'no next-receipt render call may remain');
});

test('wiring: the preview uses the same split condition', () => {
  // Plan 433: a split entry previews nothing. The line must hide
  // on exactly the same condition, or the two would disagree.
  const previewAt = quickCollectSrc.indexOf('function buildReceiptPreview()');
  assert.ok(previewAt > 0, 'receipt preview builder exists');
  const previewBody = quickCollectSrc.slice(previewAt, previewAt + 1200);
  assert.ok(
    previewBody.includes('split: !!splitToggle?.checked'),
    'preview reads the same toggle',
  );
});

// ---------------------------------------------------------------------------
// Boundaries — numbering, split flow and hosts untouched
// ---------------------------------------------------------------------------

test('boundary: receipt numbering is untouched — the pure module knows nothing about splits', () => {
  assert.ok(!moduleSrc.includes('split'), 'no split logic in the numbering module');
  // QC Modal Overhaul 2: the wiring imports only the number
  // (nextReceiptNumberFor) now — the line-text helper
  // (nextReceiptNumberLineText) is folded into the subtitle and no
  // longer imported by the controller.
  assert.ok(
    quickCollectSrc.includes("import { nextReceiptNumberFor } from './next-receipt-number.js';"),
    'module import is the number only',
  );
  assert.ok(!quickCollectSrc.includes('nextReceiptNumberLineText'), 'the line-text helper must not be imported');
});

test('boundary: no new element id — the subtitle reuses the prefill host, the next-receipt host is gone', () => {
  // QC Modal Overhaul 2: the #quickCollectNextReceiptLine host is
  // deleted with its line; the subtitle renders into the prefill
  // host (quickCollectPrefillLine) that already existed.
  const lineHosts = (quickCollectSrc.match(/getElementById\('quickCollectNextReceiptLine'\)/g) || []).length;
  assert.equal(lineHosts, 0, `no next-receipt line host may remain, found ${lineHosts}`);
  const subtitleHosts = (quickCollectSrc.match(/getElementById\('quickCollectPrefillLine'\)/g) || []).length;
  assert.equal(subtitleHosts, 1, `one subtitle host (the prefill line), found ${subtitleHosts}`);
  const toggles = (quickCollectSrc.match(/getElementById\('quickCollectSplitToggle'\)/g) || []).length;
  assert.equal(toggles, 1, `one split toggle host, found ${toggles}`);
});

test('boundary: the split submit path and combined receipt are untouched', () => {
  assert.ok(
    quickCollectSrc.includes('executeSplitTenderCollection'),
    'split recording path still referenced',
  );
  assert.ok(
    quickCollectSrc.includes("if (splitToggle?.checked) {"),
    'split submit branch still present',
  );
});

// ---------------------------------------------------------------------------
// Guards — no real names, no new hex, no store key
// ---------------------------------------------------------------------------

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
  }
});
