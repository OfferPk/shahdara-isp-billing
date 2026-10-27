import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Issue #361: the Area & zone service summary table painted its area and
// mohalla rows with hardcoded light backgrounds (#f3f8f5 / #fafcfb) and no
// dark override. In dark mode the text went light (dark-contrast.css) while
// the row backgrounds stayed light, so area/mohalla rows rendered
// near-white on near-white; zone rows have no row tint and stayed
// readable. These guards pin the dark rules that fix it, and pin the
// light-theme tints they must not disturb. The matching behavioural
// checks live in tests/e2e/analytics-dark-mode-tables.spec.mjs.
const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

test('dark mode gives summary area rows a dark tint (not the light #f3f8f5)', () => {
  assert.match(css, /\[data-theme="dark"\] \.analytics-summary-table tbody tr\.summary-row-area th,\s*\[data-theme="dark"\] \.analytics-summary-table tbody tr\.summary-row-area td \{[^}]*background: var\(--dk-surface-2\)/);
});

test('dark mode gives summary mohalla rows a dark tint (not the light #fafcfb)', () => {
  assert.match(css, /\[data-theme="dark"\] \.analytics-summary-table tbody tr\.summary-row-mohalla th,\s*\[data-theme="dark"\] \.analytics-summary-table tbody tr\.summary-row-mohalla td \{[^}]*background: var\(--dk-surface\)/);
});

test('dark mode gives summary zone rows an explicit dark surface', () => {
  assert.match(css, /\[data-theme="dark"\] \.analytics-summary-table tbody tr\.summary-row-zone th,\s*\[data-theme="dark"\] \.analytics-summary-table tbody tr\.summary-row-zone td \{[^}]*background: var\(--dk-bg\)/);
});

test('dark mode lifts the summary ARPU off its dark-green base colour', () => {
  assert.match(css, /\[data-theme="dark"\] \.analytics-summary-table \.summary-arpu \{[^}]*color: var\(--dk-accent\)/);
});

test('no dark rule for summary rows repaints a light background', () => {
  const darkRowRules = [...css.matchAll(/\[data-theme="dark"\][^{]*summary-row-(?:area|mohalla|zone)[^{]*\{[^}]*\}/g)];
  assert.ok(darkRowRules.length >= 3, `expected dark rules for all three row levels, found ${darkRowRules.length}`);
  for (const [rule] of darkRowRules) {
    assert.doesNotMatch(rule, /background:\s*#(f3f8f5|fafcfb|fff|ffffff)\b/);
  }
});

test('light theme keeps its parent/child row tints unchanged', () => {
  assert.match(css, /\.analytics-summary-table tbody tr\.summary-row-area th,\.analytics-summary-table tbody tr\.summary-row-area td\{background:#f3f8f5/);
  assert.match(css, /\.analytics-summary-table tbody tr\.summary-row-mohalla th,\.analytics-summary-table tbody tr\.summary-row-mohalla td\{background:#fafcfb/);
});
