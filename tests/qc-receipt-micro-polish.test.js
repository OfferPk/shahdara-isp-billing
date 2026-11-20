// QC receipt Final Micro-Polish (user instruction 2026-11-20) —
// behaviour-only pins for the five items. This file asserts NO parity
// total and carries no parity digits (602 pattern): it must contain
// neither the current-total bare digits nor the previous-total bare
// digits, and neither split form of them.
//
//  1. Nastaliq box: line-height 2.1, callout padding 12px 16px,
//     accent border on the RTL start (right) edge.
//  2. Banner: 8px margin-top (radius 12px already present); the
//     check sits inline beside the title — heading 14px + check 24px.
//  3. Gap above 'Date & Method': grid row-gap 2px only; the 44px
//     tap-target floor is untouched.
//  4. Header button is ✕ on every step and a TRUE CLOSE on success —
//     a NAMED REVERSAL of PR #1365 and of the QC-top D7(a) KEEP.
//  5. The yellow "WhatsApp Pending" pill is REMOVED from the QC
//     receipt card (not hidden); the builder + profile card stay.
//
// Pattern-fake data only: Test Customer, RCPT-12-202611-01, 03012345678.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderQuickCollectReceiptCardHtml } from '../nav-quick-collect.js';
import { renderReceiptSharedBadgeHtml } from '../nav-quick-profile.js';

const read = (name) => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const stylesSrc = read('styles.css');
const quickCollectSrc = read('nav-quick-collect.js');
const profileSrc = read('nav-quick-profile.js');

function ruleBlock(css, selectorWithBrace) {
  const start = css.indexOf(selectorWithBrace);
  assert.ok(start >= 0, `missing rule ${selectorWithBrace}`);
  const open = css.indexOf('{', start);
  const close = css.indexOf('}', open);
  return css.slice(open + 1, close);
}

const CARD_RECEIPT = {
  id: 'receipt-12',
  receiptNumber: 'RCPT-12-202611-01',
  amount: 1000,
  customerName: 'Test Customer',
  customerNumber: 12,
  date: '2026-11-08',
  method: 'Easypaisa',
  area: 'Sodaa',
  payableRemaining: 0,
  newTotalDues: 0,
};

test('micro-polish: Nastaliq line-height 2.1 in the shared rule (callout + terms box together)', () => {
  const start = stylesSrc.indexOf('#quickCollectSuccessMessage.qc-urdu-nastaliq,');
  assert.ok(start >= 0, 'shared Nastaliq rule missing');
  const block = stylesSrc.slice(start, stylesSrc.indexOf('}', start));
  assert.ok(block.includes('line-height: 2.1'), 'Nastaliq line-height must be 2.1 (was 2.0 — ascenders/descenders collided)');
});

test('micro-polish: callout padding 12px 16px with the accent on the RTL start (right) edge', () => {
  const callout = ruleBlock(stylesSrc, '#quickCollectModal.qc-success-open .qc-success-callout {');
  assert.ok(callout.includes('padding: 12px 16px'), 'callout padding must be 12px 16px (py-3 px-4 translated — the app has no Tailwind)');
  assert.ok(callout.includes('border-inline-start: 3px solid var(--ds-brand)'), 'callout accent must be border-inline-start (renders right under RTL)');
  assert.ok(!callout.includes('border-inline-end'), 'callout must no longer carry border-inline-end (rendered left)');
  assert.ok(callout.includes('direction: rtl'), 'callout must stay RTL');
});

test('micro-polish: banner has 8px margin-top and keeps its 12px radius; heading 14px + check 24px fit one row', () => {
  const banner = ruleBlock(stylesSrc, '#quickCollectModal.qc-success-open .qc-success-banner {');
  assert.ok(banner.includes('margin-top: 8px'), 'banner must have margin-top: 8px (mt-2)');
  assert.ok(banner.includes('border-radius: 12px'), 'banner must keep border-radius: 12px (rounded-xl — already present)');
  const heading = ruleBlock(stylesSrc, '#quickCollectSuccessHeading {');
  assert.ok(heading.includes('font-size: 14px'), 'heading must be 14px (was 16px)');
  const check = ruleBlock(stylesSrc, '#quickCollectModal.qc-success-open .qc-success-check {');
  assert.ok(check.includes('width: 24px') && check.includes('height: 24px'), 'check must be 24px (was 32px)');
  // Width budget at 360px: title ~251px at 14px bold (DejaVu upper
  // bound) + 24px check = 275px <= the 292px row. The 32px check is
  // rejected: 251 + 32 = 283 leaves 9px slack — a wide font re-wraps it.
  assert.ok(251 + 24 <= 292, 'title + check must fit the 292px row at 360px');
});

test('micro-polish: grid row-gap 2px (column-gap stays 5px); the 44px floor is untouched', () => {
  const grid = ruleBlock(stylesSrc, '#quickCollectModal.qc-success-open .qc-receipt-card .qc-receipt-grid {');
  assert.ok(grid.includes('row-gap: 2px'), 'grid row-gap must be 2px (was 5px)');
  assert.ok(grid.includes('column-gap: 5px'), 'grid column-gap must stay 5px');
  assert.ok(stylesSrc.includes('button:not([hidden]) { min-height: 44px !important; }'), 'global 44px floor must stay (the remaining gap is the pinned tap target, disclosed not fixed)');
});

test('micro-polish: header button is ✕ on every step and a true close on success (PR #1365 reversed)', () => {
  assert.ok(!quickCollectSrc.includes("stepName === 'success' ? '↩'"), 'showStep must no longer swap in ↩ on success');
  assert.ok(quickCollectSrc.includes("closeBtn.textContent = '✕';"), 'showStep must set ✕ unconditionally');
  assert.ok(quickCollectSrc.includes("closeBtn.setAttribute('aria-label', 'Close quick collect modal');"), 'aria-label must be the close label on every step');
  assert.ok(!quickCollectSrc.includes("'Back to customer list'"), 'no "Back to customer list" label may remain');
  assert.ok(quickCollectSrc.includes("closeBtn?.addEventListener('click', closeModal);"), 'header close handler must call closeModal directly');
  assert.ok(!quickCollectSrc.includes('if (stepSuccess && !stepSuccess.hidden) {'), 'header handler must no longer branch on the success step');
  assert.ok(quickCollectSrc.includes("modal.querySelector('[data-qc-next-customer]')?.addEventListener('click', collectAnotherCustomer);"), 'Next Customer button must keep the one-tap picker path');
});

test('micro-polish: rendered QC card has no WhatsApp badge and keeps the full receipt number', () => {
  const card = renderQuickCollectReceiptCardHtml(CARD_RECEIPT);
  assert.ok(!card.includes('WhatsApp Pending'), 'QC card must not contain the WhatsApp Pending pill');
  assert.ok(!card.includes('badge-receipt-unshared') && !card.includes('badge-receipt-shared'), 'QC card must not contain the shared-badge classes');
  assert.ok(card.includes('RCPT-12-202611-01'), 'QC card must keep the FULL receipt number (never re-shortened)');
  const headerStart = card.indexOf('qc-receipt-header');
  const headerEnd = card.indexOf('</div>', headerStart);
  const header = card.slice(headerStart, headerEnd);
  assert.ok(header.includes('RCPT-12-202611-01'), 'header must hold the receipt id');
  assert.ok(!header.includes('WhatsApp Pending'), 'header must not carry the badge');
});

test('micro-polish: badge builder + profile usage survive (QC card only loses it)', () => {
  assert.ok(typeof renderReceiptSharedBadgeHtml === 'function', 'renderReceiptSharedBadgeHtml must still be exported');
  assert.ok(renderReceiptSharedBadgeHtml(false).includes('WhatsApp Pending'), 'unshared badge text must survive for the profile card');
  assert.ok(profileSrc.includes('renderReceiptSharedBadgeHtml(profile.lastPayment.isShared'), 'profile card must still call the badge builder');
  assert.ok(!quickCollectSrc.includes('renderReceiptSharedBadgeHtml'), 'nav-quick-collect.js must no longer import/call the badge builder');
});

test('micro-polish: the four scoped badge rules are deleted; base rules stay', () => {
  assert.ok(!stylesSrc.includes('#quickCollectModal.qc-success-open .qc-receipt-card .qc-receipt-badge { white-space: nowrap; }'), 'scoped badge nowrap rule must be gone');
  assert.ok(!stylesSrc.includes('#quickCollectModal.qc-success-open .qc-receipt-card .badge-receipt-shared { white-space: nowrap; }'), 'scoped shared nowrap rule must be gone');
  assert.ok(!stylesSrc.includes('#quickCollectModal.qc-success-open .qc-receipt-card .badge-receipt-unshared { white-space: nowrap; padding: 2px 6px; gap: 2px; }'), 'scoped unshared shave rule must be gone');
  assert.ok(!stylesSrc.includes('#quickCollectModal.qc-success-open .qc-receipt-card .badge-receipt-unshared { background: var(--ds-warning-bg);'), 'scoped amber rule must be gone');
  assert.ok(stylesSrc.includes('#quickCollectModal.qc-success-open .qc-receipt-card .qc-receipt-header { flex-wrap: wrap; }'), 'header wrap rule stays (ref keeps its own right-aligned line)');
  assert.ok(stylesSrc.includes('.badge-receipt-shared {'), 'base shared badge rule must stay (profile card)');
  assert.ok(stylesSrc.includes('.badge-receipt-unshared {'), 'base unshared badge rule must stay (profile card)');
});
