/**
 * plan572-thermal-page-size.test.js — Plan 572: thermal slips print on a
 * roll-sized page (parent decisions D1–D10, 2026-11-18; see
 * ~/workspace/plan-572-prep.md).
 *
 * SCOPE (all D(a)): two named @page rules — `thermal80` / `thermal58`
 * (D1(a)) at `size: …mm auto; margin: 0` (D2(a)) — plus a `page:`
 * assignment on `#receiptPrintArea` under `body.printing-thermal-80` /
 * `body.printing-thermal-58` (D3(a)), all inside the `@media print`
 * block at :4510 that holds the thermal rules (D4(a)); the 80 assignment
 * mirrors the file's pair shape `body.printing-thermal …,
 * body.printing-thermal-80 …` (D5(a)); kist / settlement / offset / NOC
 * stay on A4 (D6(a)); this NEW file (D7(a)); the A4 `@page` rule stays
 * byte-identical (D10(a)); inline-@page dashboard documents out of
 * scope (D9(a)).
 * Files changed: styles.css + this file. No JS, no HTML.
 *
 * D8 DISCLOSURE — the unit gate proves the CSS (named page + assignment),
 * not browser pagination: "no second blank page" is a live print-preview
 * observation, reported in the PR body, not asserted here (T9).
 * T1 — `statement58` IS a 58mm named page but NOT a receipt page; the
 * G1 tests pin the exact decided names and assert they are not
 * `statement58`.
 * T2 — thermal-58 never gets the bare `printing-thermal` class, so the
 * 58 assignment MUST name `printing-thermal-58` explicitly.
 * T3 — exactly one unnamed `@page` must remain (the A4 one); a second
 * unnamed @page would override A4 for EVERY print flow.
 * T5 — page size is the PAPER (80mm/58mm), sheet width is the CONTENT
 * (76mm/48mm); never size a page to the sheet width.
 * T6 — `size: … auto` (roll height) is load-bearing; a fixed height
 * would re-introduce A4-like pagination.
 * T13 — `page:` belongs on the PRINTED element (`#receiptPrintArea`),
 * not the inner `.receipt-sheet`.
 * T15 — five repro pins flip by design (A1–A5); the repro re-run
 * tightens A1/A2 to the decided names `thermal80` / `thermal58`.
 *
 * Fixtures: none needed — every assertion reads `styles.css` text, plus
 * `app.js` for the class hooks. No customer data anywhere.
 *
 * Groups: G1 named pages (3) + G2 assignments (3) + G3 effective page
 * (3) + G4 guards (5) = 14 tests.
 * Expected suite: 20,388 + 14 = 20,402/0.
 * Build dist 23. Parity 4,675/4,675 (no new i18n keys).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (name) => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const styles = read('styles.css');
const appJs = read('app.js');

function hexCount(css) {
  const noComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
  return new Set(noComments.match(/#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g) || []).size;
}

// The @media print block that holds the statement + thermal rules: from
// its opener to the NEXT @media print opener (the block after it).
function thermalPrintBlock() {
  const opens = [];
  let at = -1;
  while ((at = styles.indexOf('@media print', at + 1)) >= 0) opens.push(at);
  assert.ok(opens.length >= 3, 'styles.css must carry several @media print blocks');
  // opens[0] is the A4 block (:1928); opens[3] is the statement/thermal
  // block (:4510) — the three blocks before it are the A4 block and two
  // unrelated print blocks.
  const start = opens[3];
  const end = opens[4];
  assert.ok(start >= 0 && end > start, 'the statement/thermal @media print block must exist');
  return styles.slice(start, end);
}

const block = thermalPrintBlock();

/* ---------------- G1 — named pages exist ---------------- */

test('plan572 G1 thermal80: @page thermal80 exists with roll size + zero margin (D1(a)/D2(a))', () => {
  assert.ok(/@page thermal80\s*\{\s*size:\s*80mm auto;\s*margin:\s*0;\s*\}/.test(block),
    '@page thermal80 { size: 80mm auto; margin: 0; } must exist in the thermal print block');
});

test('plan572 G1 thermal58: @page thermal58 exists with roll size + zero margin — and it is NOT statement58 (D1(a)/D2(a), T1)', () => {
  const m = block.match(/@page thermal58\s*\{\s*size:\s*58mm auto;\s*margin:\s*0;\s*\}/);
  assert.ok(m, '@page thermal58 { size: 58mm auto; margin: 0; } must exist in the thermal print block');
  const names = [...block.matchAll(/@page\s+([A-Za-z0-9_-]+)/g)].map((x) => x[1]);
  assert.ok(names.includes('thermal80'), 'the 80mm receipt page must be named thermal80');
  assert.ok(!names.includes('thermal-58'), 'the page name is thermal58, not thermal-58 (D1(a))');
  // The statement page is a different named page and must not be the
  // one the receipt rules point at (T1).
  assert.ok(names.includes('statement58'), 'the statement58 page must still exist beside the new pages');
});

test('plan572 G1 placement: both named pages sit inside the @media print block that holds the thermal rules (D4(a))', () => {
  assert.ok(block.includes('@page thermal80'), 'thermal80 must sit inside the thermal @media print block');
  assert.ok(block.includes('@page thermal58'), 'thermal58 must sit inside the thermal @media print block');
  const a4Block = styles.slice(styles.indexOf('@media print{'), styles.indexOf('}\n\n\n/* Owner Command Center'));
  assert.ok(!a4Block.includes('@page thermal80') && !a4Block.includes('@page thermal58'),
    'the named thermal pages must NOT live in the A4 @media print block (Plan 569-sliced, T4)');
});

/* ---------------- G2 — assignments ---------------- */

test('plan572 G2 thermal80: page: thermal80 is assigned under the printing-thermal pair on #receiptPrintArea (D3(a)/D5(a))', () => {
  const m = block.match(/body\.printing-thermal #receiptPrintArea,\s*body\.printing-thermal-80 #receiptPrintArea\s*\{([^}]*)\}/);
  assert.ok(m, 'the 80 #receiptPrintArea rule must use the pair selectors body.printing-thermal + body.printing-thermal-80');
  assert.ok(/page:\s*thermal80;/.test(m[1]), 'the 80 #receiptPrintArea rule must assign page: thermal80');
});

test('plan572 G2 thermal58: page: thermal58 is assigned under printing-thermal-58 on #receiptPrintArea (D3(a), T2)', () => {
  const m = block.match(/body\.printing-thermal-58 #receiptPrintArea\s*\{([^}]*)\}/);
  assert.ok(m, 'the 58 #receiptPrintArea rule must exist');
  assert.ok(/page:\s*thermal58;/.test(m[1]), 'the 58 #receiptPrintArea rule must assign page: thermal58 — the bare printing-thermal class never applies to 58 (T2)');
});

test('plan572 G2 names match: every assigned page name has a matching @page rule (a typo\'d name is valid CSS that does nothing)', () => {
  const defined = new Set([...block.matchAll(/@page\s+([A-Za-z0-9_-]+)/g)].map((x) => x[1]));
  const assigned = [...block.matchAll(/page:\s*([A-Za-z0-9_-]+);/g)].map((x) => x[1]);
  assert.ok(assigned.includes('thermal80'), 'thermal80 must be assigned somewhere in the block');
  assert.ok(assigned.includes('thermal58'), 'thermal58 must be assigned somewhere in the block');
  for (const name of assigned) {
    assert.ok(defined.has(name), `assigned page "${name}" must have a matching @page rule — a misspelled page: value silently falls back to A4`);
  }
  // The statement58 assignment is the only other page: in the block and
  // it is legitimate — its @page rule exists (G4 pins it verbatim).
  assert.ok(assigned.includes('statement58'), 'the statement58 assignment must still be present');
});

/* ---------------- G3 — effective page ---------------- */

test('plan572 G3 one unnamed @page: exactly one unnamed @page remains in styles.css, and it is the A4 rule (T3)', () => {
  const unnamed = [...styles.matchAll(/@page\s*\{/g)];
  assert.equal(unnamed.length, 1, 'there must be exactly one unnamed @page in styles.css — a second one would compete with A4');
  assert.ok(styles.includes('@page{size:A4;margin:13mm}'), 'the single unnamed @page must be the A4 rule, byte-identical');
});

test('plan572 G3 every thermal #receiptPrintArea rule carries a page: assignment', () => {
  const rules = [...block.matchAll(/body\.printing-thermal[^{]*#receiptPrintArea[^{]*\{([^}]*)\}/g)];
  assert.equal(rules.length, 2, 'there must be exactly two thermal #receiptPrintArea rules (the 80 pair + the 58 rule)');
  for (const [, body] of rules) {
    assert.ok(/page:\s*thermal\d+;/.test(body), 'every thermal #receiptPrintArea rule must carry a page: assignment — otherwise the A4 page governs it');
  }
});

test('plan572 G3 A4 rule untouched: the A4 @page rule is byte-identical to the base text (D10(a))', () => {
  assert.ok(styles.includes('@page{size:A4;margin:13mm}'), 'the A4 @page rule must be byte-identical');
  const a4Block = styles.slice(styles.indexOf('@media print{'), styles.indexOf('}\n\n\n/* Owner Command Center'));
  assert.ok(a4Block.includes('@page{size:A4;margin:13mm}'), 'the A4 rule must still sit in the first @media print block');
  assert.ok(!a4Block.includes('thermal80') && !a4Block.includes('thermal58'),
    'the A4 block must carry no thermal page names');
});

/* ---------------- G4 — guards ---------------- */

test('plan572 G4 statement58 intact: the statement page rule + assignment are verbatim (repro C2)', () => {
  assert.ok(block.includes('@page statement58 {\n    size: 58mm auto;\n    margin: 0;\n  }'),
    'the @page statement58 rule must be verbatim');
  assert.ok(block.includes('body.printing-statement-58 #accountStatementModal {\n    page: statement58;'),
    'the page: statement58 assignment must be verbatim');
});

test('plan572 G4 no leak: no page: assignment under any non-thermal print flow (repro C3/C4)', () => {
  const flows = ['printing-batch', 'printing-dashboard-summary', 'printing-invoice', 'printing-audit', 'printing-reminder'];
  for (const flow of flows) {
    const re = new RegExp(`body\\.${flow}[^{]*\\{([^}]*)\\}`, 'g');
    for (const [, body] of styles.matchAll(re)) {
      assert.ok(!/page:\s*[A-Za-z0-9_-]+;/.test(body), `no page: assignment may sit under body.${flow}`);
    }
  }
  // Plain printing-statement (no -58 suffix) must carry no page: either.
  const plain = [...styles.matchAll(/body\.printing-statement #?[^{]*\{([^}]*)\}/g)];
  for (const [, body] of plain) {
    assert.ok(!/page:\s*[A-Za-z0-9_-]+;/.test(body), 'no page: assignment may sit under plain body.printing-statement');
  }
});

test('plan572 G4 plan569 slice intact: the first @media print block still slices to the Urdu-notice rule', () => {
  const start = styles.indexOf('@media print{');
  const end = styles.indexOf('}\n\n\n/* Owner Command Center', start);
  assert.ok(start >= 0 && end > start, 'the Plan 569 slice markers must exist');
  const slice = styles.slice(start, end);
  assert.ok(slice.includes('.receipt-urdu-script'), 'the sliced block must still contain the Urdu-script rules');
  assert.ok(slice.includes('body.printing-receipt .receipt-urdu-script .receipt-urdu-notice{break-inside:avoid}'),
    'the sliced block must still contain the Urdu-notice break-inside rule');
});

test('plan572 G4 braces balanced in styles.css (sharafat-95 C7 shape)', () => {
  assert.equal((styles.match(/\{/g) || []).length, (styles.match(/\}/g) || []).length,
    'styles.css brace mismatch — the added rules must keep braces balanced');
});

test('plan572 G4 no new hex: the added lines carry no hex, and the styles.css hex count is unchanged at 608 (T12)', () => {
  // 613 → 608 with Plan 589 (one focus-ring colour): the two dead
  // baselines' #16745a/#0b624b deleted, #6caa91/#97d7bd/#1a5845
  // re-tokened to var(--green). Five distinct hex leave, none added.
  assert.equal(hexCount(styles), 608, `styles.css hex count moved (${hexCount(styles)})`);
  // The added lines are ONLY the Plan 572 comment + the two @page rules
  // + the two `page:` lines — slice them precisely (the rest of the
  // thermal block legitimately carries #fff / #000 in its own rules).
  const added = block.match(/\/\* Thermal receipts on roll-sized pages[\s\S]*?@page thermal58\s*\{[^}]*\}/);
  assert.ok(added, 'the added Plan 572 comment + @page rules must exist');
  assert.ok(!/#[0-9a-fA-F]{3,6}\b/.test(added[0]), 'the added Plan 572 comment + @page rules must contain no hex colour');
  assert.ok(!/#/.test('page: thermal80;') && !/#/.test('page: thermal58;'), 'the two page: lines must contain no hex colour');
  assert.ok(appJs.includes("classList.add('printing-thermal-58')"), 'the print path must still add printing-thermal-58 for 58');
  assert.ok(appJs.includes("classList.add('printing-thermal', 'printing-thermal-80')"), 'the print path must still add printing-thermal + printing-thermal-80 for 80');
});
