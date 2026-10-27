import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Issue #361: on narrow screens the Customer rankings filters sat in a
// cramped 2-column grid, so native select values clipped
// ("Highest-payir…", "All recorded a…"). The fix stacks the rankings
// filters full-width at ≤700px; the desktop grids stay untouched. The
// matching behavioural checks live in
// tests/e2e/customer-rankings-filters.spec.mjs.
const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

test('rankings filters stack full-width at ≤700px, scoped to the rankings panel', () => {
  assert.match(css, /@media\(max-width:700px\)\{\s*section\[aria-labelledby="customerRankingHeading"\] \.owner-filter-grid\{grid-template-columns:1fr\}/);
});

test('desktop filter grids are untouched', () => {
  assert.match(css, /\.owner-filter-grid\{display:grid;grid-template-columns:repeat\(5,minmax\(130px,1fr\)\)/);
  assert.match(css, /@media\(max-width:900px\)\{\.owner-filter-grid\{grid-template-columns:repeat\(3,minmax\(0,1fr\)\)\}/);
  assert.match(css, /\.owner-filter-grid\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\);gap:8px\}/);
});

test('ranking subtext wraps instead of overflowing its card', () => {
  assert.match(css, /\.owner-result-main span\{[^}]*overflow-wrap:anywhere/);
});

test('ranking amount is emphasized with the theme-aware ink colour', () => {
  assert.match(css, /\.owner-result-value\{font-size:12px;font-weight:700;color:var\(--ink\)\}/);
  assert.match(css, /\.owner-result-value\{font-size:12px;text-align:right\}/);
});

test('dark-mode coverage for ranking cards and selects is intact', () => {
  assert.match(css, /\[data-theme="dark"\] \.owner-result-card,/);
  assert.match(css, /\[data-theme="dark"\] select,\s*\[data-theme="dark"\] textarea \{[^}]*background: #0f1c18/);
});
