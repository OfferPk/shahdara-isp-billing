// Plan 548: Quick Collect inline styles move onto tokens.
// The duplicate card's "Save anyway" buttons, the delete-undo button, the
// JS-generated header charge lines and the one-screen panel carried inline
// style= attributes — a hardcoded hex (#e53e3e) no token owns, a fallback
// hex (#c62828) behind a var (--overdue) that is never defined anywhere,
// and layout styles that belong in classes. Every one of those styles now
// lives in bulk-collect.css on tokens only (zero new hex); the tags carry
// no style= attribute any more. All money shown in PKR only (no money
// touched here).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => readFileSync(join(root, f), 'utf8');

const pageSrc = read('index.html');
const navSrc = read('nav-quick-collect.js');
const oneScreenSrc = read('quick-collect-one-screen.js');
const bulkCss = read('bulk-collect.css');

function buttonTag(src, id) {
  const at = src.indexOf(`id="${id}"`);
  assert.ok(at > 0, `expected a button with id ${id}`);
  const start = src.lastIndexOf('<button', at);
  const end = src.indexOf('</button>', at);
  assert.ok(start > 0 && end > start, `expected a closed button tag for ${id}`);
  return src.slice(start, end);
}

function tagContaining(src, needle) {
  const at = src.indexOf(needle);
  assert.ok(at > 0, `expected markup containing ${needle}`);
  const start = src.lastIndexOf('<button', at);
  const end = src.indexOf('</button>', at);
  assert.ok(start > 0 && end > start, `expected a closed button tag around ${needle}`);
  return src.slice(start, end);
}

function ruleBlock(css, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = css.match(new RegExp(`${escaped}\\s*\\{[^}]*\\}`));
  assert.ok(m, `expected a rule for ${selector} in bulk-collect.css`);
  return m[0];
}

test('duplicate: both Save-anyway buttons carry the token class and no inline style', () => {
  const leg2Tag = tagContaining(pageSrc, 'qc-split-duplicate-proceed');
  assert.match(leg2Tag, /qc-duplicate-proceed/);
  assert.match(leg2Tag, /Save anyway/);
  assert.doesNotMatch(leg2Tag, /style=/);
  const mainTag = buttonTag(pageSrc, 'quickCollectDuplicateProceedBtn');
  assert.match(mainTag, /qc-duplicate-proceed/);
  assert.match(mainTag, /Save anyway/);
  assert.doesNotMatch(mainTag, /style=/);
  // The hardcoded hex no token owns is gone from the page entirely.
  assert.doesNotMatch(pageSrc, /#e53e3e/i);
});

test('duplicate: the shared class rule uses the danger token and no hex', () => {
  const rule = ruleBlock(bulkCss, '.primary-button.qc-duplicate-proceed');
  assert.match(rule, /background:\s*var\(--color-danger\)/);
  // 12px on the type scale: the token, not the hard-coded size (Plan A
  // forbids hard-coded scale font sizes in this file).
  assert.match(rule, /font-size:\s*var\(--text-xs\)/);
  assert.match(rule, /padding:\s*6px 12px/);
  assert.doesNotMatch(rule, /#/);
  // Dark theme keeps a dark-red background with white text: --color-danger
  // resolves to a light pink (#ffb4a8) in dark, so the dark override uses
  // the stronger danger token instead (same pattern as bulk-collect.css's
  // other [data-theme="dark"] overrides).
  const darkRule = ruleBlock(bulkCss, '[data-theme="dark"] .primary-button.qc-duplicate-proceed');
  assert.match(darkRule, /background:\s*var\(--color-danger-strong\)/);
  assert.doesNotMatch(darkRule, /#/);
});

test('undo: the delete undo has no inline style; its red lives in the id rule only', () => {
  const deleteTag = buttonTag(pageSrc, 'quickCollectUndoBtn');
  assert.match(deleteTag, /secondary-button qc-undo-btn/);
  assert.doesNotMatch(deleteTag, /style=/);
  assert.doesNotMatch(deleteTag, /#c62828/);
  // The red hangs off the id, NOT the shared qc-undo-btn class: the
  // reversal undo shares that class and must stay plain secondary.
  const rule = ruleBlock(bulkCss, '#quickCollectUndoBtn');
  assert.match(rule, /border-color:\s*var\(--color-overdue\)/);
  assert.match(rule, /color:\s*var\(--color-overdue\)/);
  // No hex colour in the rule (the '#' here is the id selector itself).
  assert.doesNotMatch(rule, /#[0-9a-fA-F]{3,6}\b/);
  assert.doesNotMatch(bulkCss, /\.qc-undo-btn\s*\{[^}]*color/);
  // The undefined --overdue var (with its #c62828 fallback) is gone.
  assert.doesNotMatch(bulkCss, /var\(--overdue/);
});

test('undo: the reversal undo stays plain secondary', () => {
  const reversalTag = buttonTag(pageSrc, 'quickCollectReversalUndoBtn');
  assert.match(reversalTag, /secondary-button qc-undo-btn/);
  assert.doesNotMatch(reversalTag, /style=/);
  assert.doesNotMatch(reversalTag, /var\(--overdue/);
  assert.doesNotMatch(reversalTag, /#c62828/);
});

test('header: charge lines and charges divs have no inline style; classes carry the layout', () => {
  assert.doesNotMatch(navSrc, /style="display:block;"/);
  assert.doesNotMatch(navSrc, /style="margin-top:6px;font-size:0\.85rem;"/);
  // The classes are still on the same elements (only the style= moved).
  assert.ok(navSrc.includes('class="qc-head-charge-line"'), 'charge-line spans keep their class');
  assert.ok(navSrc.includes('class="qc-head-charges"'), 'charges divs keep their class');
  const lineRule = ruleBlock(bulkCss, '.qc-head-charge-line');
  assert.match(lineRule, /display:\s*block/);
  const boxRule = ruleBlock(bulkCss, '.qc-head-charges');
  assert.match(boxRule, /margin-top:\s*6px/);
  assert.match(boxRule, /font-size:\s*0\.85rem/);
});

test('one-screen: top row and Save have no inline style; new classes carry the layout', () => {
  assert.doesNotMatch(oneScreenSrc, /style="display:flex;/);
  assert.doesNotMatch(oneScreenSrc, /style="width:100%;"/);
  assert.ok(oneScreenSrc.includes('class="qc-one-screen-top-row"'), 'top row carries its new class');
  const saveTag = tagContaining(oneScreenSrc, 'qosOneScreenSaveBtn');
  assert.match(saveTag, /primary-button/);
  assert.match(saveTag, /qc-one-screen-save/);
  // The design's ".qc-confirm-btn already provides it" does not hold for
  // this button: that class would restyle it green/padded (background
  // #16a34a, 14px padding, 1.05rem font) — a visible change. The width
  // moved into its own class instead, so the button keeps primary-button.
  assert.doesNotMatch(saveTag, /qc-confirm-btn/);
  const rowRule = ruleBlock(bulkCss, '.qc-one-screen-top-row');
  assert.match(rowRule, /display:\s*flex/);
  assert.match(rowRule, /align-items:\s*center/);
  assert.match(rowRule, /justify-content:\s*space-between/);
  assert.match(rowRule, /margin-bottom:\s*8px/);
  const saveRule = ruleBlock(bulkCss, '.qc-one-screen-save');
  assert.match(saveRule, /width:\s*100%/);
});

test('tokens: the moved styles add no new hex anywhere', () => {
  // The ratchet baseline for bulk-collect.css is 37 distinct hex colours;
  // the Plan 548 rules add none (var() tokens only, no fallbacks with hex).
  const stripped = bulkCss.replace(/\/\*[\s\S]*?\*\//g, '');
  const distinct = new Set(stripped.match(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g) || []);
  assert.ok(distinct.size <= 37, `bulk-collect.css has ${distinct.size} distinct hex colours, baseline is 37`);
  for (const [name, src] of [['index.html', pageSrc], ['nav-quick-collect.js', navSrc], ['quick-collect-one-screen.js', oneScreenSrc], ['bulk-collect.css', bulkCss]]) {
    assert.doesNotMatch(src, /#e53e3e/i, `${name} must not contain the old duplicate red`);
    assert.doesNotMatch(src, /#c62828/i, `${name} must not contain the old undo fallback red`);
  }
});
