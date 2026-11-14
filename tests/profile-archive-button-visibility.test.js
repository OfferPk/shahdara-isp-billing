// Profile Archive Button Visibility + Record Payment Button
// (user report 2026-11-13, 2 screenshots): "Record payment WALLA
// button lamba hai tu Shahid woh archive button kahi gum ho gaya
// hai" — Archive sat two taps deep in More Actions > Payments, so
// the user could not see it. This item deliberately reverses the
// Profile Polish B (10) seat: Record payment goes half-width and
// Archive joins Row 1 beside it, [Record payment | Archive].
// Source-scan pins only (no jsdom in the unit gate).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (name) => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const index = read('index.html');
const styles = read('styles.css');
const components = read('components.css');
const app = read('app.js');

test('archive button visibility: Archive is a direct child of the action group, ahead of More actions, NOT in the Payments category', () => {
  const groupAt = index.indexOf('class="profile-action-group"');
  const detailsAt = index.indexOf('id="profileMoreActionsDetails"', groupAt);
  const archiveAt = index.indexOf('id="archiveCustomerButton"', groupAt);
  const recordAt = index.indexOf('id="currentBillPaymentShortcut"', groupAt);
  assert.ok(groupAt >= 0, 'action group exists');
  assert.ok(archiveAt > recordAt, 'Archive follows Record payment in Row 1');
  assert.ok(archiveAt < detailsAt, 'Archive sits ahead of the More actions disclosure');
  // Direct child: no <details> opens between the group open and Archive.
  const groupSlice = index.slice(groupAt, archiveAt);
  assert.ok(!groupSlice.includes('<details'), 'Archive is a direct child of the action group, not nested in a disclosure');
  // Byte-identical seat change only: id, classes, icon and i18n key kept.
  assert.ok(index.includes('id="archiveCustomerButton" class="secondary-button profile-action-btn"'), 'Archive keeps its classes');
  assert.ok(index.includes('data-ds-icon="Archive"'), 'Archive keeps its icon');
  assert.ok(index.includes('data-i18n="prof_action_archive"'), 'Archive keeps its i18n key');
  const paymentsAt = index.indexOf('data-i18n="prof_ma_cat_payments"');
  const paymentsEnd = index.indexOf('</details>', paymentsAt);
  assert.ok(!index.slice(paymentsAt, paymentsEnd).includes('id="archiveCustomerButton"'), 'Archive is not in the Payments category');
});

test('archive button visibility: Record keeps its row at phone widths; Archive spans row 3 alone at ≤620px — neither Record nor the pair shares a row any more', () => {
  // Profile View Polish (user report 2026-11-13): Delete leaves Row 1
  // for the danger zone, so the five remaining buttons land 2+2 with
  // Archive alone on row 3 — Archive now SPANS that row (the #1393
  // "neither spans" pin was about Record, not Archive). The shortcut
  // still never spans the full row at any phone breakpoint.
  assert.ok(!styles.includes('.current-payment-shortcut{grid-column:1/-1'), 'no rule spans Record payment full-width any more');
  assert.ok(!components.includes('.profile-action-group > .current-payment-shortcut'), '≤480px: Record payment is not in the spanning selector list');
  // ≤800px rule keeps the 2-col grid; the stretched-Delete clause is
  // dead once Delete leaves the group, so it is removed.
  assert.ok(styles.includes('@media(max-width:800px){.profile-action-group{grid-template-columns:minmax(0,1fr) auto}}'), '≤800px rule keeps the 2-col grid without the dead danger clause');
  // ≤620px rule (the block opening with .detail-head): the shortcut
  // keeps its 48px height but loses the span; Archive takes the span.
  const block620At = styles.indexOf('@media(max-width:620px){.detail-head{margin-bottom:0}');
  assert.ok(block620At >= 0, '≤620px profile block exists');
  const block620 = styles.slice(block620At, styles.indexOf('\n', block620At));
  assert.ok(block620.includes('.profile-action-group .current-payment-shortcut{min-height:48px}'), '≤620px: Record payment keeps its 48px height');
  assert.ok(!block620.includes('.profile-action-group .current-payment-shortcut{grid-column:1/-1'), '≤620px: Record payment does not span the row');
  assert.ok(block620.includes('.profile-action-group #archiveCustomerButton{grid-column:1/-1}'), '≤620px: Archive spans row 3 alone');
  assert.ok(components.includes('.profile-action-group > .backdated-payment-link'), '≤480px: the backdated link still spans');
  assert.ok(components.includes('.profile-action-group > .customer-technical-tools'), '≤480px: the technical tools still span');
  // The 2-column grid itself survives at every phone breakpoint, so
  // the buttons land side by side instead of stacking.
  assert.ok(block620.includes('.profile-action-group{grid-template-columns:repeat(2,minmax(0,1fr))'), '≤620px grid stays 2-column');
  assert.ok(components.includes('.profile-action-group { grid-template-columns: repeat(2, minmax(0, 1fr)); }'), '≤480px grid stays 2-column');
});

test('archive button visibility: desktop grid is five columns — one per Row 1 button', () => {
  // Profile View Polish: Delete leaves Row 1, so the six-column grid
  // from the Archive item drops back to five (Edit / Clear dues /
  // Wada / Record payment / Archive). Archive's seat is unchanged.
  assert.ok(styles.includes('.profile-action-group{display:grid;grid-template-columns:minmax(0,1fr) auto auto auto auto;'), 'desktop grid has five columns for Edit / Clear dues / Wada / Record payment / Archive');
});

test('archive button visibility: Record payment carries the inline-flex gap rule (icon-text gap fix)', () => {
  // The tile and the label sat flush: .primary-button has no flex/gap
  // and the markup has no whitespace between the 36px tile and the
  // text. The scoped rule centres them with an 8px gap.
  assert.match(
    styles,
    /\.profile-action-group \.current-payment-shortcut\{display:inline-flex;align-items:center;justify-content:center;gap:8px\}/,
    'Record payment has the inline-flex gap rule',
  );
  // The label may wrap to two lines at phone widths (white-space:normal
  // at ≤620px) and the 48px floor fits the 36px tile + two lines.
  assert.ok(styles.includes('.current-payment-shortcut{white-space:normal}'), 'Record label may wrap at phone widths');
});

test('archive button visibility: wiring and hidden toggles are untouched — the move is static markup only', () => {
  assert.ok(app.includes("$('#currentBillPaymentShortcut').addEventListener('click'"), 'Record payment wiring still attaches once at startup');
  assert.ok(app.includes("$('#archiveCustomerButton').addEventListener('click'"), 'Archive wiring still attaches once at startup');
  assert.ok(app.includes("$('#archiveCustomerButton').hidden = customer.archived"), 'Archive still hides on an archived profile');
  assert.ok(app.includes("$('#unarchiveCustomerButton').hidden = !customer.archived"), 'Unarchive still shows on an archived profile');
  assert.ok(app.includes("$('#clearDuesButton').hidden = customer.archived;"), 'Clear dues still hides on an archived profile');
});

test('archive button visibility: styles.css still 613 distinct hex (no new hard-coded colour)', () => {
  const stripped = styles.replace(/\/\*[\s\S]*?\*\//g, '');
  const distinct = new Set(stripped.match(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g) || []);
  // 614 → 613 with Customers Cards Compact (item B): deleting the
  // card's health-reasons rule removed its unique hex #62766d.
  assert.equal(distinct.size, 613, 'styles.css must stay at 613 distinct hex (no new hard-coded colour)');
});

test('archive button visibility: no real customer names or phone numbers in this test', () => {
  const testSrc = read('tests/profile-archive-button-visibility.test.js');
  const phoneShape = /(?:\+92|03)\d[\d\s-]{8,}\d/;
  assert.ok(!phoneShape.test(testSrc), 'test must not contain a realistic phone number');
});
