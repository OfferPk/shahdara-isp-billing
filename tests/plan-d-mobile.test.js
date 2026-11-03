// Plan D — Mobile responsiveness: the ≤480px operator phone, plus the
// mandatory build-test fix (the gate only read the Node 22+ spec
// reporter, so the CI test job on main @ 24f84504 failed with
// "UNIT ? pass / ? fail / ? tests" on Node 20 even though npm ci
// had succeeded and no test had failed).
//
// Tests are CSS/contract tests in the established style: the ≤480px
// rules live in components.css (which loads last, so they win at
// equal specificity), and the gate parser is tested directly.
// No browser rendering is available in this environment, so no test
// here claims a measured pixel layout — each test pins the rule
// that produces the layout.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  parseTestSummary,
  failingTestFiles,
  classifyFailures,
} from '../scripts/test-gate.mjs';

const read = name => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const components = read('components.css');
const styles = read('styles.css');
const index = read('index.html');

// ---- CSS helpers ------------------------------------------------------

// The Plan D block is the LAST `@media (max-width: 480px)` block in
// components.css (it is appended at the end of the file).
function lastMediaBlock(css, query) {
  const marker = `@media (${query})`;
  const start = css.lastIndexOf(marker);
  assert.ok(start >= 0, `no ${marker} block found`);
  const open = css.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    if (css[i] === '{') depth++;
    if (css[i] === '}') {
      depth--;
      if (depth === 0) return css.slice(open + 1, i);
    }
  }
  throw new Error(`unclosed ${marker} block`);
}

const planD = lastMediaBlock(components, 'max-width: 480px');
const flat = s => s.replace(/\s+/g, ' ');

function ruleDecls(block, selector) {
  const flatBlock = flat(block);
  // Match the selector as a whole rule head: the next non-space char
  // must be "{" (so ".field-mode-search" never matches
  // ".field-mode-search-row"). For multi-selector rules the caller
  // passes the full comma list.
  const escaped = flat(selector).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const head = new RegExp(`${escaped}\\s*\\{`);
  const at = flatBlock.search(head);
  assert.ok(at >= 0, `selector "${selector}" missing`);
  const open = flatBlock.indexOf('{', at);
  const close = flatBlock.indexOf('}', open);
  assert.ok(open >= 0 && close > open, `rule for "${selector}" has no declarations`);
  return flatBlock.slice(open + 1, close);
}

function assertRule(block, selector, prop, value) {
  const decls = ruleDecls(block, selector);
  assert.match(decls, new RegExp(`${prop}\\s*:\\s*${value}`),
    `"${selector}" must set ${prop}: ${value} (has: ${decls.trim()})`);
}

// ---- Gate fix: two reporter formats ------------------------------------

const TAP_SUMMARY = [
  'TAP version 13',
  'ok 1 - a passes',
  'not ok 2 - a fails',
  '1..2',
  '# tests 2',
  '# suites 0',
  '# pass 1',
  '# fail 1',
  '# cancelled 0',
  '# skipped 0',
  '# todo 0',
  '# duration_ms 181.6',
].join('\n');

const SPEC_SUMMARY = [
  '✔ a passes (1.1ms)',
  '✖ a fails (1.2ms)',
  'ℹ tests 2',
  'ℹ suites 0',
  'ℹ pass 1',
  'ℹ fail 1',
  'ℹ cancelled 0',
  'ℹ skipped 0',
  'ℹ todo 0',
  'ℹ duration_ms 157.7',
  '',
  '✖ failing tests:',
  '',
  'test at tests/perf-budget-219.test.js:4:1',
].join('\n');

test('Plan D gate: Node 20 TAP summary parses (the CI format)', () => {
  assert.deepEqual(parseTestSummary(TAP_SUMMARY), { tests: 2, pass: 1, fail: 1 });
});

test('Plan D gate: Node 22+ spec summary still parses', () => {
  assert.deepEqual(parseTestSummary(SPEC_SUMMARY), { tests: 2, pass: 1, fail: 1 });
});

test('Plan D gate: spec wins when both formats are present', () => {
  assert.deepEqual(parseTestSummary(`${TAP_SUMMARY}\n${SPEC_SUMMARY}`),
    { tests: 2, pass: 1, fail: 1 });
});

test('Plan D gate: no summary in either format is still nulls, never zeros', () => {
  assert.deepEqual(parseTestSummary('some output with no summary at all'),
    { tests: null, pass: null, fail: null });
});

test('Plan D gate: TAP location lines name the failing file', () => {
  const out = [
    'not ok 2 - a fails',
    '  ---',
    "  location: '/home/runner/work/x/tests/build-output.test.js:12:3'",
    '  ...',
  ].join('\n');
  assert.deepEqual(failingTestFiles(out), ['tests/build-output.test.js']);
});

test('Plan D gate: TAP failing build-gap file is classified as a known gap', () => {
  const files = failingTestFiles(
    "  location: '/home/runner/work/x/tests/manifest-verifier.test.js:9:1'\n");
  assert.deepEqual(classifyFailures(files),
    { knownBuildGap: ['tests/manifest-verifier.test.js'], other: [] });
});

test('Plan D gate: TAP failing ordinary file is classified as other', () => {
  const files = failingTestFiles(
    "  location: '/home/runner/work/x/tests/plan-d-mobile.test.js:9:1'\n");
  assert.deepEqual(classifyFailures(files),
    { knownBuildGap: [], other: ['tests/plan-d-mobile.test.js'] });
});

test('Plan D gate: spec test-at lines still name the failing file', () => {
  assert.deepEqual(failingTestFiles(SPEC_SUMMARY), ['tests/perf-budget-219.test.js']);
});

test('Plan D gate: a stack trace naming a file does not invent a failing file', () => {
  const out = [
    '    at Test.run (file:///home/runner/work/x/tests/build-output.test.js:4:30)',
    '    at something else (tests/other.test.js:1:1)',
  ].join('\n');
  assert.deepEqual(failingTestFiles(out), []);
});

// ---- Plan D ≤480px block: Quick Collect tap targets --------------------

test('Plan D block: a ≤480px block exists at the end of components.css', () => {
  assert.ok(planD.length > 0, 'Plan D block must not be empty');
  const last480 = components.lastIndexOf('@media (max-width: 480px)');
  const after = components.slice(last480);
  assert.match(after, /\.profile-action-group \{ grid-template-columns: repeat\(2, minmax\(0, 1fr\)\); \}/,
    'the last ≤480px block must be the Plan D block');
});

test('Plan D QC: filter chips meet the 44px tap target', () => {
  assertRule(planD, '.quick-collect-filter-chip', 'min-height', '44px');
});

test('Plan D QC: quick-amount chips meet the 44px tap target', () => {
  assertRule(planD, '.quick-amount-chip', 'min-height', '44px');
});

test('Plan D QC: date chips meet the 44px tap target', () => {
  assertRule(planD, '.qc-date-chip', 'min-height', '44px');
});

test('Plan D QC: loose-change chips meet the 44px tap target', () => {
  assertRule(planD, '.loose-change-chip', 'min-height', '44px');
});

test('Plan D QC: search-clear button is a 44px target', () => {
  assertRule(planD, '.qc-search-clear', 'min-width', '44px');
  assertRule(planD, '.qc-search-clear', 'min-height', '44px');
});

test('Plan D QC: search input keeps its text clear of the bigger clear button', () => {
  assertRule(planD, '.qc-search-input', 'padding-right', '56px');
});

// ---- Plan D ≤480px block: Quick Collect rows ----------------------------

test('Plan D QC: step-2 header bar wraps instead of squeezing', () => {
  assertRule(planD, '.qc-active-cust-bar', 'flex-wrap', 'wrap');
  assertRule(planD, '.qc-active-cust-bar', 'gap', '8px');
});

test('Plan D QC: header identity shrinks and the due box never shrinks', () => {
  assertRule(planD, '.qc-cust-identity', 'min-width', '0');
  assertRule(planD, '.qc-cust-identity', 'flex', '1 1 auto');
  assertRule(planD, '.qc-head-due-box', 'flex', 'none');
});

test('Plan D QC: header name wraps instead of pushing the due box off', () => {
  assertRule(planD, '.qc-head-name', 'overflow-wrap', 'anywhere');
});

test('Plan D QC: customer rows have a gap and a non-shrinking due column', () => {
  assertRule(planD, '.qc-customer-card', 'gap', '8px');
  assertRule(planD, '.qc-card-right', 'flex', 'none');
});

// ---- Plan D ≤480px block: Field Mode ------------------------------------

test('Plan D Field Mode: search row wraps so the input gets its own row', () => {
  assertRule(planD, '.field-mode-search-row', 'flex-wrap', 'wrap');
  assertRule(planD, '.field-mode-search', 'flex-basis', '100%');
});

test('Plan D Field Mode: view padding tightens at phone widths', () => {
  assertRule(planD, '.field-mode-view', 'padding', '12px 12px');
});

test('Plan D Field Mode: header help button is a 44px target', () => {
  assertRule(planD, '.field-mode-head .help-info-btn', 'width', '44px');
  assertRule(planD, '.field-mode-head .help-info-btn', 'height', '44px');
});

// ---- Plan D ≤480px block: profile payment -------------------------------

test('Plan D profile: action group is two equal columns at ≤480px', () => {
  assertRule(planD, '.profile-action-group', 'grid-template-columns',
    'repeat\\(2, minmax\\(0, 1fr\\)\\)');
});

test('Plan D profile: payment shortcut, backdated link and tools span full rows', () => {
  const decls = ruleDecls(planD,
    '.profile-action-group > .current-payment-shortcut, .profile-action-group > .backdated-payment-link, .profile-action-group > .customer-technical-tools');
  assert.match(decls, /grid-column\s*:\s*1 \/ -1/,
    `full-row spans missing (has: ${decls.trim()})`);
});

// ---- Plan D block hygiene ------------------------------------------------

test('Plan D block: no new hard-coded hex colours', () => {
  assert.doesNotMatch(planD, /#[0-9a-fA-F]{3,8}\b/,
    'Plan D adds no hex values (token-only, per Plan A)');
});

test('Plan D block: components.css braces are still balanced', () => {
  const open = components.split('{').length - 1;
  const close = components.split('}').length - 1;
  assert.equal(open, close, `components.css has ${open} "{" but ${close} "}"`);
});

// ---- Already covered at phone widths (pinned, not changed) --------------

test('Plan D pinned: Quick Collect dialog is contained at ≤640px', () => {
  assert.match(styles, /dialog\.quick-collect-modal,\s*\n?\s*dialog\.fast-customer-search-modal/);
  assert.match(styles, /width: calc\(100vw - 16px\) !important;/);
});

test('Plan D pinned: Quick Collect form rows collapse to one column at ≤480px', () => {
  const at = styles.indexOf('@media (max-width: 480px)');
  assert.ok(at >= 0, 'styles.css has a ≤480px block');
  const block = styles.slice(at, at + 400);
  assert.match(block, /\.qc-form-row \{\s*\n?\s*grid-template-columns: 1fr;/);
});

test('Plan D pinned: Field Mode zone chips are already 44px', () => {
  assert.match(components, /\.field-mode-zone-chip \{[^}]*min-height: 44px;/s);
});

test('Plan D pinned: Field Mode action buttons are already 48px', () => {
  assert.match(components, /\.field-mode-action-btn \{[^}]*min-height: 48px;/s);
});

test('Plan D pinned: Field Mode waada and loose chips are already 44px+', () => {
  assert.match(components, /\.field-mode-waada-chip \{[^}]*min-height: 44px;/s);
  assert.match(components, /\.field-mode-loose-chip \{[^}]*min-height: 48px;/s);
});

test('Plan D pinned: Quick Collect method chips are already 44px', () => {
  assert.match(styles, /\.quick-method-chip \{[^}]*min-height: 44px;/s);
});

test('Plan D pinned: Field Mode view never scrolls sideways', () => {
  assert.match(components, /\.field-mode-view \{[^}]*overflow-x: hidden;/s);
});

test('Plan D pinned: Field Mode inner is capped and shrinkable', () => {
  assert.match(components, /\.field-mode-inner \{[^}]*max-width: 560px;[^}]*min-width: 0;/s);
});

test('Plan D pinned: Customers list rows are 48px at ≤620px', () => {
  assert.match(styles, /\.customer-select\{min-height:48px\}/);
});

test('Plan D pinned: Customers search input and button are 44px at ≤620px', () => {
  assert.match(styles, /\.customer-list-search-control input\{height:44px;font-size:16px\}/);
  assert.match(styles, /\.customer-list-search-control \.secondary-button\{min-height:44px\}/);
});

test('Plan D pinned: Customers filter and service-choice buttons are 44px at ≤620px', () => {
  assert.match(styles, /\.service-choice\{min-height:44px;padding:6px 9px;font-size:10px\}/);
});

test('Plan D pinned: profile payment form-grid is one column at ≤700px', () => {
  assert.match(styles, /\.form-grid, \.phase3-form, \.incident-form \{ grid-template-columns: minmax\(0, 1fr\); \}/);
});

test('Plan D pinned: profile payment inputs are 44px with 16px text', () => {
  assert.match(styles, /\.form-grid input, \.form-grid select \{ min-height: 44px; font-size: 16px; \}/);
});

test('Plan D pinned: profile shortcut already spans a full row at ≤800px', () => {
  assert.match(styles, /\.profile-action-group \.current-payment-shortcut\{grid-column:1\/-1\}/);
});

test('Plan D pinned: Quick Collect customer names ellipsize, never overflow', () => {
  assert.match(styles, /\.qc-cust-name \{[^}]*text-overflow: ellipsis;/s);
  assert.match(styles, /\.qc-card-left \{[^}]*min-width: 0;/s);
});

test('Plan D pinned: Quick Collect filter pills scroll instead of overflowing', () => {
  assert.match(styles, /\.qc-filter-pills \{[^}]*overflow-x: auto;/s);
});

test('Plan D pinned: Field Mode customer buttons are 56px rows', () => {
  assert.match(components, /\.field-mode-customer-btn \{[^}]*min-height: 56px;/s);
});

// ---- Covered flows exist in the markup -----------------------------------

test('Plan D markup: Quick Collect modal exists', () => {
  assert.ok(index.includes('id="quickCollectModal"'), 'quickCollectModal missing');
});

test('Plan D markup: Field Mode view, search and close exist', () => {
  assert.ok(index.includes('id="fieldModeView"'), 'fieldModeView missing');
  assert.ok(index.includes('id="fieldModeSearchInput"'), 'fieldModeSearchInput missing');
  assert.ok(index.includes('id="fieldModeCloseBtn"'), 'fieldModeCloseBtn missing');
});

test('Plan D markup: Field Mode search row has Clear and Scan QR actions', () => {
  assert.ok(index.includes('id="fieldModeSearchClearBtn"'), 'search Clear missing');
  assert.ok(index.includes('id="fieldModeScanQrBtn"'), 'Scan QR missing');
});
