import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Plan E — Dark-mode completion: customer, payment, Transactions and
// receipt-preview screens meet the same contrast bar as the
// already-tested screens (dark-contrast-customers, analytics dark
// tables): dark text >= 4.5:1 on dark surfaces, no light card left
// behind, no screen needing a theme toggle to stay readable.
// Pattern follows the existing dark tests: pin the dark rule in the
// stylesheet, and pin the light value it must not disturb.
// Deliberate non-changes are pinned too, so a later plan cannot
// silently re-lighten a chip or repaint the paper receipt sheet.

const dark = readFileSync(new URL('../dark-contrast.css', import.meta.url), 'utf8');
const tokens = readFileSync(new URL('../tokens.css', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
const paymentsList = readFileSync(new URL('../payments-list.css', import.meta.url), 'utf8');
const components = readFileSync(new URL('../components.css', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const appJs = readFileSync(new URL('../app.js', import.meta.url), 'utf8');

// tokens.css [data-theme="dark"] block only (not the
// prefers-color-scheme block, not :root).
const darkBlock = (() => {
  const start = tokens.indexOf('[data-theme="dark"] {');
  const end = tokens.indexOf('\n}\n\n@media', start);
  assert.ok(start >= 0 && end > start, 'tokens dark block not found');
  return tokens.slice(start, end);
})();

// --- Shared status chips: paid / success / overdue / info ---

test('dark gives the paid chip the received-green dark pair', () => {
  assert.match(dark, /\[data-theme="dark"\] :is\(\.ds-chip--paid, \.ds-chip--success\) \{[^}]*background: #14382a[^}]*color: #8fe0b6/);
});

test('dark gives the success chip the same received-green dark pair', () => {
  assert.match(dark, /\[data-theme="dark"\] :is\(\.ds-chip--paid, \.ds-chip--success\) \{[^}]*background: #14382a[^}]*color: #8fe0b6/);
});

test('dark gives the overdue chip the offline-red dark pair', () => {
  assert.match(dark, /\[data-theme="dark"\] \.ds-chip--overdue \{[^}]*background: #402a24[^}]*color: #ffb4a8/);
});

test('dark gives the info chip the bank-blue dark pair via tokens (not new hex)', () => {
  assert.match(dark, /\[data-theme="dark"\] \.ds-chip--info \{[^}]*background: var\(--color-info-bg\)[^}]*color: var\(--color-info-strong\)/);
});

test('dark gives the cash method chip the received-green dark pair explicitly', () => {
  assert.match(dark, /\[data-theme="dark"\] :is\(\.tx-method-cash, \.tx-method-easypaisa\) \{[^}]*background: #14382a[^}]*color: #8fe0b6/);
});

test('dark gives the easypaisa method chip the received-green dark pair explicitly', () => {
  assert.match(dark, /\[data-theme="dark"\] :is\(\.tx-method-cash, \.tx-method-easypaisa\) \{[^}]*background: #14382a[^}]*color: #8fe0b6/);
});

test('light keeps the paid chip on its light pair (unchanged by Plan E)', () => {
  assert.match(components, /\.ds-chip--paid \{ background: var\(--color-paid-bg\); color: var\(--color-paid\); \}/);
});

test('dark tokens already carry the pending pair, so the pending chip needs no override', () => {
  assert.match(tokens, /--color-pending: #fbbf24/);
  assert.match(tokens, /--color-pending-bg: #2d230d/);
});

// --- Transactions screen ---

test('dark lifts transaction-card meta text to the muted dark colour', () => {
  assert.match(dark, /\[data-theme="dark"\] \.transaction-card :is\(\.transaction-meta, \.transaction-context\) \{[^}]*color: var\(--dk-muted\)/);
});

test('dark lifts transaction-card context text to the muted dark colour', () => {
  assert.match(dark, /\[data-theme="dark"\] \.transaction-card :is\(\.transaction-meta, \.transaction-context\) \{[^}]*color: var\(--dk-muted\)/);
});

test('dark gives the transaction card a dark surface (styles.css rule, unchanged)', () => {
  assert.match(styles, /\[data-theme="dark"\] \.transaction-card,\n?/);
  assert.ok(styles.includes('[data-theme="dark"] .transaction-card,') || styles.includes('.transaction-card,\n'), 'transaction-card dark rule');
});

test('dark gives the transactions pane a dark surface (styles.css rule, unchanged)', () => {
  assert.match(styles, /\[data-theme="dark"\] \.transactions-pane,/);
});

test('light transaction rows are transparent, so no light card leaks into dark mode', () => {
  assert.match(paymentsList, /\.tx-compact > button\.tx-row:not\(\[hidden\]\) \{[^}]*background: transparent/);
});

test('dark gives filter inputs/selects a dark surface via the generic form rule', () => {
  assert.match(styles, /\[data-theme="dark"\] input,\n\[data-theme="dark"\] select,\n\[data-theme="dark"\] textarea \{[^}]*background: #0f1c18[^}]*color: #e8f3ee/);
});

// --- Customer screen: archived panel ---

test('dark gives the archived panel a dark border', () => {
  assert.match(dark, /\[data-theme="dark"\] \.archived-customers-panel \{[^}]*border-color: var\(--dk-line\)/);
});

test('dark lifts the archived panel summary off its light grey', () => {
  assert.match(dark, /\[data-theme="dark"\] \.archived-customers-panel > summary \{[^}]*color: var\(--dk-muted\)/);
});

test('dark gives archived items a dark separator', () => {
  assert.match(dark, /\[data-theme="dark"\] \.archived-customer-item \{[^}]*border-color: var\(--dk-line\)/);
});

test('light archived list sets no background of its own (nothing to leak)', () => {
  const rule = styles.match(/\.archived-customer-list\{[^}]*\}/);
  assert.ok(rule, 'archived-customer-list rule');
  assert.doesNotMatch(rule[0], /background:/);
});

test('dark archived summary rule does not repaint the light grey', () => {
  const rule = dark.match(/\[data-theme="dark"\] \.archived-customers-panel > summary \{[^}]*\}/);
  assert.ok(rule, 'archived summary dark rule');
  assert.doesNotMatch(rule[0], /#536a61/);
});

// --- Receipt preview (paper sheet deliberately untouched) ---

test('dark gives receipt WhatsApp actions a dark surface outside tx-details', () => {
  assert.match(dark, /\[data-theme="dark"\] :is\(\.receipt-whatsapp-action, \.receipt-phone-help\) \{[^}]*background: var\(--dk-surface-2\)[^}]*color: var\(--dk-ink\)/);
});

test('dark gives receipt phone help a dark surface outside tx-details', () => {
  assert.match(dark, /\[data-theme="dark"\] :is\(\.receipt-whatsapp-action, \.receipt-phone-help\) \{[^}]*background: var\(--dk-surface-2\)[^}]*color: var\(--dk-ink\)/);
});

test('dark gives the print-receipt button a dark surface (styles.css rule, unchanged)', () => {
  assert.match(styles, /\[data-theme="dark"\] \.print-receipt-button \{[^}]*background: #182d27[^}]*color: #34d399/);
});

test('the receipt sheet stays paper-white with dark text in the light theme', () => {
  assert.match(styles, /\.receipt-sheet\{[^}]*background:#fff;color:#172b24/);
});

test('no dark rule repaints the receipt sheet background', () => {
  assert.doesNotMatch(dark, /\[data-theme="dark"\][^{]*\.receipt-sheet[^{]*\{[^}]*background:/);
  assert.doesNotMatch(styles, /\[data-theme="dark"\][^{]*\.receipt-sheet[^{]*\{[^}]*background:/);
});

test('receipt field values stay dark-on-white on the paper sheet', () => {
  assert.match(styles, /\.receipt-field dd\{[^}]*color:#182c24/);
});

test('receipt paid status stays dark green on the paper sheet', () => {
  assert.match(styles, /\.receipt-field dd\.receipt-status-paid\{color:#145b38\}/);
});

test('receipt partial status stays dark amber on the paper sheet', () => {
  assert.match(styles, /\.receipt-field dd\.receipt-status-partial\{color:#8a4c08\}/);
});

test('dark gives batch receipt slips a dark surface (styles.css rule, unchanged)', () => {
  assert.match(styles, /\[data-theme="dark"\] \.batch-receipt-slip \{[^}]*background: #182a24/);
});

test('dark gives batch receipt controls a dark surface (styles.css rule, unchanged)', () => {
  assert.match(styles, /\[data-theme="dark"\] \.batch-receipt-controls \{[^}]*background: #14241f/);
});

// --- Theme persistence (already stored; pinned, not changed) ---

test('index.html reads the stored theme and applies it before paint', () => {
  assert.match(html, /localStorage\.getItem\('shahdara_theme'\)/);
  assert.match(html, /document\.documentElement\.setAttribute\('data-theme',t\)/);
});

test('index.html falls back to the system dark preference when nothing is stored', () => {
  assert.match(html, /matchMedia\('\(prefers-color-scheme: dark\)'\)\.matches\?'dark':'light'/);
});

test('app.js persists the chosen theme under the same key', () => {
  assert.match(appJs, /localStorage\.setItem\('shahdara_theme', theme\)/);
});

test('both dark token blocks define the dark surface set', () => {
  const count = (tokens.match(/--dk-surface: #182d27/g) || []).length;
  assert.ok(count >= 2, `expected --dk-surface in both dark blocks, found ${count}`);
  assert.match(tokens, /--dk-ink: #e8f3ee/);
  assert.match(tokens, /--dk-muted: #b7cbc2/);
});

// --- Tokens deliberately NOT redefined in dark (solid-button safety) ---

test('light paid token values are unchanged', () => {
  assert.match(tokens, /--color-paid-bg: #e8f5ed/);
  assert.match(tokens, /--color-paid: #19704e/);
});

test('tokens dark block does not redefine the paid token', () => {
  assert.doesNotMatch(darkBlock, /--color-paid:/);
});

test('light success token values are unchanged', () => {
  assert.match(tokens, /--color-success-bg: #d1fae5/);
  assert.match(tokens, /--color-success: #059669/);
});

test('tokens dark block does not redefine the success or overdue tokens', () => {
  assert.doesNotMatch(darkBlock, /--color-success:/);
  assert.doesNotMatch(darkBlock, /--color-overdue:/);
});

// --- Payment / customer regressions already covered ---

test('dark gives easypaisa table headers a dark surface (payments-inbox rule, unchanged)', () => {
  const inbox = readFileSync(new URL('../payments-inbox.css', import.meta.url), 'utf8');
  assert.match(inbox, /\[data-theme="dark"\] \.easypaisa-table th \{/);
});

test('dark gives easypaisa table cells a dark surface (payments-inbox rule, unchanged)', () => {
  const inbox = readFileSync(new URL('../payments-inbox.css', import.meta.url), 'utf8');
  assert.match(inbox, /\[data-theme="dark"\] \.easypaisa-table td \{/);
});

test('dark gives payment rows a dark surface (dark-contrast rule, unchanged)', () => {
  assert.match(dark, /\.payment-row,/);
});

test('dark gives the editing payment form a dark surface (dark-contrast rule, unchanged)', () => {
  assert.match(dark, /\.payment-form\.editing\) \{/);
});
