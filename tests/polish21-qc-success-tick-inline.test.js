// Polish 21 — Quick Collect success screen: tick inline beside the
// heading (28 px, animation re-triggered on EVERY showing), Urdu message
// separated from the heading, status pills merged into one compact
// section, terms fit one screenshot, support number on one line with
// tappable WhatsApp + call icons (QC screen only, amended Req 4),
// WhatsApp Pending red on the success screen.
// Pattern-fake data only: Test Customer, RCPT-12-202611-01. The real
// support number lives solely in receipt-terms.js (a disclosed ratchet
// exemption) — every assertion below derives its digits from the
// module's support-line constant and never re-types the number.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  RECEIPT_TERMS_PHRASE,
  RECEIPT_SUPPORT_LINE,
  receiptTermsNoteHtml,
  receiptTermsNoteText,
} from '../receipt-terms.js';
import { renderQuickCollectReceiptCardHtml } from '../nav-quick-collect.js';
import {
  renderSplitReceiptCardHtml,
  generateSplitTenderReceiptHtml,
} from '../split-tender-collect.js';
import { buildPaymentReceipt, generatePaymentReceiptHtml } from '../receipt.js';
import { renderReceiptSharedBadgeHtml } from '../nav-quick-profile.js';

const read = (name) => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const stylesSrc = read('styles.css');
const pageSrc = read('index.html');
const quickCollectSrc = read('nav-quick-collect.js');
const splitSrc = read('split-tender-collect.js');
const termsSrc = read('receipt-terms.js');

// The support number's digit run, derived from the module — never
// re-typed. The international form is the trailing digit run of the
// published line; the local form is the same digits with the country
// code replaced by the trunk 0.
const digits = RECEIPT_SUPPORT_LINE.replace(/\D/g, '');
const intlForm = RECEIPT_SUPPORT_LINE.match(/[+\d][\d ]*$/)[0];
const localForm = `0${digits.slice(2)}`;

function ruleBlock(css, selectorWithBrace) {
  const start = css.indexOf(selectorWithBrace);
  assert.ok(start >= 0, `missing rule ${selectorWithBrace}`);
  const open = css.indexOf('{', start);
  const close = css.indexOf('}', open);
  return css.slice(open + 1, close);
}

function extractBalanced(css, marker) {
  const start = css.indexOf(marker);
  assert.ok(start >= 0, `missing block ${marker}`);
  const open = css.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    if (css[i] === '{') depth++;
    if (css[i] === '}') {
      depth--;
      if (depth === 0) return css.slice(open + 1, i);
    }
  }
  assert.fail(`unbalanced block at ${marker}`);
  return '';
}

// --- Req 1: tick inline -------------------------------------------------

test('tick inline: the tick sits inside a heading row beside the heading, 18px SVG, no hero row', () => {
  assert.ok(digits.startsWith('92'), 'precondition: the support digits derive with the country code');
  const row = pageSrc.indexOf('<div class="qc-success-heading-row">');
  assert.ok(row >= 0, 'heading row missing');
  const tick = pageSrc.indexOf('<span class="qc-success-check"', row);
  const heading = pageSrc.indexOf('id="quickCollectSuccessHeading"', row);
  const message = pageSrc.indexOf('id="quickCollectSuccessMessage"', row);
  // Tick-in-box fix: the tick follows the heading (was before it, so it
  // sat outside the heading's focus outline on the left).
  assert.ok(tick > row && tick > heading, 'tick must sit inside the heading row, after the heading');
  assert.ok(heading < tick, 'heading must precede the tick in the row');
  assert.ok(message > heading, 'message must sit below the heading row');
  assert.equal((pageSrc.match(/class="qc-success-check"/g) || []).length, 1, 'exactly one tick on the screen — no hero row left');
  const spanEnd = pageSrc.indexOf('</span>', tick);
  const span = pageSrc.slice(tick, spanEnd);
  assert.ok(span.includes('aria-hidden="true"'), 'tick stays aria-hidden (the heading announces success)');
  assert.ok(!span.includes('✓'), 'tick must not be the text glyph');
  // Tick-in-box fix: SVG 18 → 20px (with the 28 → 32px circle).
  assert.ok(span.includes('<svg viewBox="0 0 24 24" width="20" height="20" fill="none">'), 'tick must be the 20px SVG');
  assert.ok(span.includes('<path class="qc-check-draw" d="M5 12.5l4.5 4.5L19 7.5"'), 'tick path must be the design check');
  assert.ok(span.includes('stroke="#16a34a"'), 'tick stroke must reuse the existing check green');
  assert.ok(span.includes('stroke-width="3"'), 'tick stroke must be 3px');
  assert.ok(span.includes('stroke-linecap="round"') && span.includes('stroke-linejoin="round"'), 'tick must have round caps and joins');
  const headingEnd = pageSrc.indexOf('</h3>', heading);
  const headingHtml = pageSrc.slice(heading, headingEnd);
  assert.ok(headingHtml.includes('tabindex="-1"'), 'heading keeps tabindex -1 (focus announcement)');
  assert.ok(headingHtml.includes('Payment Recorded Successfully'), 'heading wording unchanged');
});

test('tick inline: 32px circle on success, centred row, tick never shrinks', () => {
  // The success-scoped border-removal rule precedes the base rule in
  // indexOf, so the base rule is anchored at column 0.
  const row = ruleBlock(stylesSrc, '\n.qc-success-heading-row {');
  assert.ok(row.includes('display: flex'), 'heading row must be flex');
  assert.ok(row.includes('align-items: center'), 'row must centre the tick against the heading');
  assert.ok(row.includes('justify-content: center'), 'row must be centred like the banner');
  assert.ok(row.includes('gap: 8px'), 'row gap must be 8px');
  const tickInRow = ruleBlock(stylesSrc, '.qc-success-heading-row .qc-success-check {');
  assert.ok(tickInRow.includes('margin-bottom: 0'), 'the base 8px bottom margin must not apply inside the row');
  assert.ok(tickInRow.includes('flex-shrink: 0'), 'the tick must never squeeze');
  const check = ruleBlock(stylesSrc, '#quickCollectModal.qc-success-open .qc-success-check {');
  // Tick-in-box fix: 28 → 32px — the tick looked lost beside the
  // two-line 18px heading. It costs 0px vertically (row height is
  // driven by the ~54px heading).
  assert.ok(check.includes('width: 32px') && check.includes('height: 32px'), 'inline tick must be 32px on success');
  assert.ok(!check.includes('animation:'), 'the pop must not live on the size rule any more (it is trigger-gated)');
});

// --- Req 7: animation re-trigger ----------------------------------------

test('tick trigger: base draw rule carries no animation; the play class gates draw + pop, once, forwards', () => {
  const draw = ruleBlock(stylesSrc, '.qc-check-draw {');
  assert.ok(draw.includes('stroke-dasharray: 24'), 'path length must be 24');
  assert.ok(draw.includes('stroke-dashoffset: 24'), 'path must start fully hidden');
  assert.ok(!draw.includes('animation'), 'base draw rule must carry NO animation — nothing may run at page load while the step is hidden');
  const playDraw = ruleBlock(stylesSrc, '#quickCollectModal.qc-success-open .qc-success-check.qc-tick-play .qc-check-draw {');
  assert.ok(playDraw.includes('animation: qc-check-draw .6s ease-out .1s forwards'), 'triggered draw must run in 0.6s after a 0.1s delay, once, forwards');
  assert.ok(!playDraw.includes('infinite'), 'draw must not loop');
  assert.ok(!playDraw.includes('qc-check-pop'), 'the pop lives on the circle span only (no double-scaling the path)');
  const playPop = ruleBlock(stylesSrc, '#quickCollectModal.qc-success-open .qc-success-check.qc-tick-play {');
  assert.ok(playPop.includes('animation: qc-check-pop .45s cubic-bezier(.2,1.4,.4,1) forwards'), 'triggered pop must run in 0.45s, once, forwards');
  assert.ok(!playPop.includes('infinite'), 'pop must not loop');
  const drawFrames = extractBalanced(stylesSrc, '@keyframes qc-check-draw');
  assert.ok(drawFrames.includes('stroke-dashoffset: 0'), 'draw keyframes must end at dashoffset 0 (fully drawn)');
  const popFrames = extractBalanced(stylesSrc, '@keyframes qc-check-pop');
  assert.ok(popFrames.includes('transform: scale(.6)') && popFrames.includes('transform: scale(1.08)') && popFrames.includes('transform: scale(1)'), 'pop keyframes unchanged (.6 → 1.08 → 1)');
});

test('tick re-trigger: showStep removes the trigger class, forces a reflow, re-adds it on every success entry (guarded for stub hosts)', () => {
  const start = quickCollectSrc.indexOf('function showStep(stepName)');
  assert.ok(start >= 0, 'showStep missing');
  const end = quickCollectSrc.indexOf('\n  function ', start + 1);
  const body = quickCollectSrc.slice(start, end === -1 ? undefined : end);
  assert.ok(body.includes("stepName === 'success'"), 're-trigger must run only on the success entry');
  assert.ok(body.includes("querySelector('.qc-success-check')"), 're-trigger must find the tick inside the modal');
  const removeAt = body.indexOf("classList.remove('qc-tick-play')");
  const reflowAt = body.indexOf('offsetWidth');
  const addAt = body.indexOf("classList.add('qc-tick-play')");
  assert.ok(removeAt > 0, 'showStep must remove the trigger class');
  assert.ok(reflowAt > removeAt, 'showStep must force a reflow after removing the class');
  assert.ok(addAt > reflowAt, 'showStep must re-add the trigger class after the reflow');
  assert.ok(body.includes('modal') && body.includes('querySelector'), 're-trigger must be guarded for stub hosts (no modal / no querySelector / no tick → no throw)');
});

// --- Req 2: separation ---------------------------------------------------

test('separation: the Urdu message gets 8px of air below the heading on success', () => {
  // QC receipt-modal overhaul (§4.3.5): the message moved out of the
  // banner into its own callout box below it — the 8px of air is now
  // structural (the success step gap), not a margin-top on the message.
  // The message inside the callout keeps margin 0.
  const callout = ruleBlock(stylesSrc, '#quickCollectModal.qc-success-open .qc-success-callout {');
  assert.ok(callout.includes('padding: 10px 14px'), 'callout must carry its own padding');
  const message = ruleBlock(stylesSrc, '#quickCollectModal.qc-success-open .qc-success-callout #quickCollectSuccessMessage {');
  assert.ok(message.includes('margin: 0'), 'message margins stay 0 inside the callout');
  const step = ruleBlock(stylesSrc, '#quickCollectModal.qc-success-open #quickCollectStepSuccess {');
  assert.ok(step.includes('gap: 8px'), 'success step gap must be 8px — the callout sits 8px below the banner');
  const base = ruleBlock(stylesSrc, '#quickCollectSuccessMessage {');
  assert.ok(base.includes('margin: 0'), 'base message margins stay 0');
});

// --- Req 4: support number — one line + contact actions (amended) -------

test('terms nowrap: the support number sits in a nowrap LTR span, wording byte-identical, plain text unchanged', () => {
  const html = receiptTermsNoteHtml();
  assert.ok(html.startsWith('<div class="receipt-urdu-notice" dir="rtl" lang="ur">'), 'shared helper output must stay the bare notice');
  assert.ok(html.includes(`<span class="receipt-support-number" dir="ltr">${intlForm}</span>`), 'default rendering must wrap the international number in the nowrap LTR span');
  assert.ok(!html.includes('wa.me'), 'default rendering must not add a WhatsApp link (other surfaces)');
  assert.ok(!html.includes('tel:'), 'default rendering must not add a call link (other surfaces)');
  assert.ok(html.includes(RECEIPT_TERMS_PHRASE), 'terms phrase unchanged');
  assert.equal(receiptTermsNoteText(), `${RECEIPT_TERMS_PHRASE}\n${RECEIPT_SUPPORT_LINE}`, 'plain text for WhatsApp drafts and the clipboard is byte-identical');
  assert.ok(stylesSrc.includes('.receipt-support-number { white-space: nowrap; }'), 'global nowrap rule must exist');
});

test('terms contact actions: QC rendering shows the local form with tappable WhatsApp + call icons', () => {
  const html = receiptTermsNoteHtml({ contactActions: true });
  const spanStart = html.indexOf('<span class="receipt-support-number" dir="ltr">');
  assert.ok(spanStart >= 0, 'contact-actions rendering must keep the nowrap LTR span');
  const spanEnd = html.indexOf('</span>', spanStart);
  const span = html.slice(spanStart, spanEnd);
  const displayed = span.slice(span.indexOf('>') + 1, span.indexOf('<a'));
  assert.equal(displayed, localForm, 'displayed number must be the local form derived from the same digits');
  assert.ok(!displayed.includes('+') && !displayed.includes(' '), 'displayed number must have no + and no spaces');
  assert.match(displayed, /^0\d+$/, 'displayed number must be the trunk-0 local form');
  assert.ok(span.includes(`href="https://wa.me/${digits}"`), 'WhatsApp link must be the wa.me international form derived from the same digits');
  assert.ok(span.includes(`href="tel:+${digits}"`), 'call link must be the tel: international form');
  assert.ok(span.includes('class="receipt-support-action receipt-support-whatsapp"'), 'WhatsApp icon link must carry its class');
  assert.ok(span.includes('class="receipt-support-action receipt-support-call"'), 'call icon link must carry its class');
  const waStart = span.indexOf('receipt-support-whatsapp');
  const waSvg = span.slice(waStart, span.indexOf('</a>', waStart));
  assert.ok(waSvg.includes('<svg') && waSvg.includes('M19.05 4.91'), 'WhatsApp icon must be the speech-bubble-with-phone mark, not a generic chat bubble');
  const callStart = span.indexOf('receipt-support-call');
  const callSvg = span.slice(callStart, span.indexOf('</a>', callStart));
  assert.ok(callSvg.includes('<svg') && callSvg.includes('M22 16.92'), 'call icon must be the phone handset mark');
  assert.ok(html.includes(RECEIPT_TERMS_PHRASE), 'terms phrase unchanged in the contact-actions rendering');
});

test('terms contact actions: the two QC cards carry them; other surfaces do not', () => {
  const card = renderQuickCollectReceiptCardHtml(CARD_RECEIPT);
  assert.ok(card.includes(`>${localForm}<`), 'ordinary QC card must show the local form');
  assert.ok(card.includes('wa.me/') && card.includes('tel:+'), 'ordinary QC card must carry both contact links');
  assert.ok(card.includes('receipt-support-action'), 'ordinary QC card must carry the icons');
  const split = renderSplitReceiptCardHtml(SPLIT_COMBINED);
  assert.ok(split.includes(`>${localForm}<`), 'split QC card must show the local form');
  assert.ok(split.includes('wa.me/') && split.includes('tel:+'), 'split QC card must carry both contact links');
  const sheet = generateSplitTenderReceiptHtml(SPLIT_COMBINED);
  assert.ok(!sheet.includes('wa.me/') && !sheet.includes('receipt-support-action'), 'split printable sheet must not gain the icons');
  assert.ok(sheet.includes(intlForm), 'split printable sheet keeps the international form');
  const bill = { id: 'bill-2026-08', month: '2026-08', dueAmount: 2000, status: 'pending', payments: [] };
  const payment = { id: 'pay-print-1', amount: 2000, date: '2026-08-07', method: 'Cash' };
  bill.payments = [payment];
  const customer = { id: 'synthetic-customer', customerNumber: 42, name: 'Synthetic Customer', packageSpeed: '5 Mbps', packageHistory: [], bills: [bill] };
  const receipt = buildPaymentReceipt(customer, bill, payment);
  const printed = generatePaymentReceiptHtml(receipt, { format: 'a4', businessName: 'Shahdara Fiber Net' });
  assert.ok(!printed.includes('wa.me/') && !printed.includes('receipt-support-action'), 'printed receipt must not gain the icons');
  assert.ok(printed.includes(intlForm), 'printed receipt keeps the international form');
  assert.ok(!termsSrc.includes('qc-urdu'), 'receipt-terms.js must not reference the QC classes');
});

// --- Req 6: status merge --------------------------------------------------

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

const SPLIT_COMBINED = {
  splitGroupId: 'grp-1',
  customerId: '12',
  customerNumber: 12,
  customerName: 'Test Customer',
  customerNameUrdu: '',
  phone: '03012345678',
  area: 'Sodaa',
  month: '2026-11',
  date: '2026-11-08',
  package: '5 Mbps',
  legs: [
    { leg: 1, paymentId: 'pay-a', receiptNumber: 'RCPT-12-202611-01', method: 'Cash', amount: 500, transactionId: '', date: '2026-11-08', voided: false },
    { leg: 2, paymentId: 'pay-b', receiptNumber: 'RCPT-12-202611-02', method: 'Easypaisa', amount: 500, transactionId: 'TID-000001', date: '2026-11-08', voided: false },
  ],
  totalReceivedCents: 100000,
  totalReceived: 1000,
  balanceDueCents: 0,
  status: 'PAID',
};

const SPLIT_PARTIAL = { ...SPLIT_COMBINED, balanceDueCents: 100000, status: 'PARTIAL' };

test('status merge: one section holds exactly two pills in order still-owes → saved (settle badge removed)', () => {
  // QC receipt-modal overhaul (§4.3.2): the settle badge was a third
  // still-owed signal that could disagree with the pill — it is gone,
  // and the merged Still-owed row in the card carries the settled/
  // partial state. Exactly two pills remain.
  const row = pageSrc.indexOf('class="qc-success-pills-row"');
  assert.ok(row >= 0, 'pills row missing');
  const stillOwes = pageSrc.indexOf('id="sowStillOwesLine"', row);
  const saved = pageSrc.indexOf('id="osbOfflineSavedBadge"', row);
  assert.ok(stillOwes > row, 'still-owes line must sit inside the pills row');
  assert.ok(saved > stillOwes, 'saved badge must follow the still-owes line');
  assert.ok(!pageSrc.includes('id="qcSettleStatusBadge"'), 'settle host must be gone');
  const rowClose = pageSrc.indexOf('</div>', saved);
  const card = pageSrc.indexOf('id="quickCollectReceiptCard"');
  assert.ok(rowClose >= 0 && rowClose < card, 'pills row must close before the receipt card');
});

test('status merge: the card headers no longer carry the settle badge (ordinary + split)', () => {
  const card = renderQuickCollectReceiptCardHtml(CARD_RECEIPT);
  assert.ok(!card.includes('Settle in Full'), 'ordinary card header must not carry the settle badge any more');
  assert.ok(!card.includes('Partial Payment'), 'ordinary card header must not carry the partial badge any more');
  const headerStart = card.indexOf('qc-receipt-header');
  const headerEnd = card.indexOf('</div>', headerStart);
  const header = card.slice(headerStart, headerEnd);
  assert.ok(header.includes('badge-receipt-unshared'), 'ordinary card header must keep the shared badge');
  assert.ok(header.includes('RCPT-12-202611-01'), 'ordinary card header must keep the receipt id');
  const splitSettled = renderSplitReceiptCardHtml(SPLIT_COMBINED);
  assert.ok(!splitSettled.includes('Settle in Full'), 'split card header must not carry the settle badge any more');
  const splitPartial = renderSplitReceiptCardHtml(SPLIT_PARTIAL);
  assert.ok(!splitPartial.includes('Partial Payment'), 'split card header must not carry the partial badge any more');
  assert.ok(splitPartial.includes('qc-receipt-id'), 'split card header must keep its id');
});

test('status merge: the merged Still-owed row is written from the same receipt figure (wiring)', () => {
  // QC receipt-modal overhaul (§4.3.2): the settle badge is gone — the
  // merged Still-owed row in the card builder is the surface that reads
  // the canonical remaining figure, branching on remainingPayable > 0.
  assert.ok(!quickCollectSrc.includes('function renderSettleStatusBadge()'), 'settle render must be gone');
  assert.ok(
    quickCollectSrc.includes('const remainingPayable = receipt.payableRemaining ?? receipt.newTotalDues ?? receipt.newBalanceDue ?? 0;'),
    'card builder must compute the canonical remaining figure',
  );
  assert.ok(
    quickCollectSrc.includes('remainingPayable > 0 ? `PKR ${formatReceiptMoneyFigure(remainingPayable)}` : escapeHtml(SUCCESS_NEXT_STEPS_FULLY_PAID_TEXT)'),
    'merged row must branch on remainingPayable > 0',
  );
  assert.ok(!quickCollectSrc.includes("'✓ Settle in Full'"), 'settle badge text must be gone');
  assert.ok(!quickCollectSrc.includes("'⏳ Partial Payment'"), 'partial badge text must be gone');
});

test('status merge: compact badge sizing (12px, 2px 8px) + 6px section gap', () => {
  const rowGap = ruleBlock(stylesSrc, '#quickCollectModal.qc-success-open .qc-success-pills-row {');
  assert.ok(rowGap.includes('gap: 6px'), 'merged section gap must be 6px');
  const owes = ruleBlock(stylesSrc, '#quickCollectModal.qc-success-open .qc-success-pills-row .sow-still-owes {');
  assert.ok(owes.includes('font-size: 12px'), 'still-owes pill must demote to 12px (unified with the other pills)');
  assert.ok(owes.includes('padding: 2px 8px'), 'still-owes pill must take the card-badge padding');
  assert.ok(owes.includes('margin: 0'), 'still-owes margin must stay 0 inside the row');
  const badge = ruleBlock(stylesSrc, '#quickCollectModal.qc-success-open .qc-success-pills-row .osb-saved-badge {');
  assert.ok(badge.includes('padding: 2px 8px'), 'saved badge must take the card-badge padding');
  assert.ok(badge.includes('margin: 0'), 'saved badge margin must stay 0 inside the row');
  // The settle host is gone (QC receipt-modal overhaul §4.3.2) — the
  // merged Still-owed row in the card carries the settled state now.
  assert.ok(!stylesSrc.includes('.qc-receipt-badge.settled'), 'no settle-badge sizing may remain');
});

// --- Req 8: red pending pill ----------------------------------------------

test('amber pending pill: success-scoped warning amber + dark text; global rule and sent state untouched', () => {
  // QC receipt-modal overhaul (§4.3.4): the pending pill is AMBER now —
  // a deliberate reversal of polish #21's user-requested red (the red
  // read as an error on a success screen; amber reads as "waiting").
  // The rule lives in the Polish 21 block — look it up there, not in
  // the whole sheet: the polish #17 C3 rule shares the same selector
  // tail (white-space: nowrap) and would match first.
  const polish21Start = stylesSrc.indexOf('/* Polish 21 — Quick Collect');
  assert.ok(polish21Start >= 0, 'Polish 21 CSS block missing');
  const polish21Css = stylesSrc.slice(polish21Start, stylesSrc.indexOf('/* End Polish 21', polish21Start));
  const red = ruleBlock(polish21Css, '#quickCollectModal.qc-success-open .qc-receipt-card .badge-receipt-unshared {');
  assert.ok(red.includes('background: var(--ds-warning-bg)'), 'pending pill background must be the warning token');
  assert.ok(red.includes('color: var(--ds-warning)'), 'pending pill text must be the warning token');
  assert.ok(red.includes('border-color: var(--ds-warning-border)'), 'pending pill border must be the warning-border token');
  assert.ok(!red.includes('#'), 'amber pill rule must add zero hex literals (tokens only)');
  // The global rule starts at column 0 — the polish #17 C3 rule shares
  // the selector tail mid-line and would match first.
  const global = ruleBlock(stylesSrc, '\n.badge-receipt-unshared {');
  assert.ok(global.includes('background: #f1f5f9'), 'global unshared rule must stay grey (other surfaces keep it)');
  assert.ok(global.includes('color: #64748b'), 'global unshared text must stay grey');
  const shared = ruleBlock(stylesSrc, '\n.badge-receipt-shared {');
  assert.ok(shared.includes('background: #dcfce7'), 'sent state (green shared badge) must be untouched');
  const badge = renderReceiptSharedBadgeHtml(false);
  assert.ok(badge.includes('WhatsApp Pending'), 'unshared badge text unchanged');
  assert.ok(badge.includes('<circle') && badge.includes('<polyline'), 'clock icon kept on the pending pill');
});
