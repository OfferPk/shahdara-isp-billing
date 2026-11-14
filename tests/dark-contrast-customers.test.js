import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Text-level guards for the dark-mode customer-card fix: dark-contrast.css must
// keep dark rules for the surfaces that styles.css paints light. The matching
// behavioural checks live in tests/e2e/dark-mode-customers.spec.mjs.
const css = readFileSync(new URL('../dark-contrast.css', import.meta.url), 'utf8');
const darkRule = (selectorPattern) => new RegExp(`\\[data-theme="dark"\\][^}]*${selectorPattern}[^]*?\\{[^}]*\\}`, 'm');

test('dark-contrast gives the customer card body a dark surface', () => {
  assert.match(css, /\[data-theme="dark"\] \.customer-select\.customer-profile-card-open \{[^}]*background:[^}]*--dk-surface/);
});

test('dark-contrast keeps the selected customer card distinct', () => {
  assert.match(css, /\[data-theme="dark"\] \.customer-select\.customer-profile-card-open\[aria-current="true"\] \{[^}]*background:/);
});

test('dark-contrast darkens the service-choice chips and their state variants', () => {
  assert.match(css, /\[data-theme="dark"\] \.service-choice \{[^}]*background:[^}]*--dk-surface-2/);
  assert.match(css, /\[data-theme="dark"\] \.service-choice-active \{[^}]*background:/);
  assert.match(css, /\[data-theme="dark"\] \.service-choice-offline \{[^}]*background:/);
});

test('dark-contrast darkens the archived unarchive button', () => {
  assert.match(css, /\[data-theme="dark"\] \.archived-unarchive-button \{[^}]*background:[^}]*--dk-surface-2/);
});

test('dark-contrast has a billing badge variant for status-partial', () => {
  assert.match(css, /\[data-theme="dark"\] :is\(\.month-status, \.report-status, \.customer-billing-badge\)\.status-partial \{/);
});

test('dark-contrast drops the card health-reasons rule with the card reasons — the profile summary keeps its dark rules', () => {
  // Customers Cards Compact (B2) deleted the card's health-reasons
  // <details> and its dark rule with it. The profile still renders
  // the same reasons in its Billing tab (.customer-health-summary),
  // and THAT keeps dark treatment — pin the summary rules, not the
  // deleted card rule.
  assert.doesNotMatch(css, /\.customer-health-reasons/, 'no card health-reasons rule in dark-contrast.css');
  assert.match(css, /\[data-theme="dark"\] \.customer-health-summary summary,/);
  assert.match(css, /\[data-theme="dark"\] :is\(\.profile-summary-stat, \.current-bill-stat, \.customer-card-stat, \.customer-health-summary,/);
});

test('dark tokens live in tokens.css (#230) and dark-contrast still uses them', () => {
  // #230 moved the --dk-* definitions into tokens.css (single source of
  // truth); dark-contrast.css keeps consuming them via var().
  const tokens = readFileSync(new URL('../tokens.css', import.meta.url), 'utf8');
  assert.match(tokens, /--dk-surface: #182d27/);
  assert.match(tokens, /--dk-ink: #e8f3ee/);
  assert.match(css, /var\(--dk-surface\)/);
});
