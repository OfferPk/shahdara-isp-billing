// Polish 17 (Req 2) — Compact fit: the Quick Collect success view fits
// one mobile screenshot — from the top of the dialog to the end of the
// receipt card (terms included) ≤ 700 CSS px at 360 px width, with no
// scrolling. The blocks below the card (next steps, repeat, share draft,
// second connection, actions) stay below the fold by design.
// This test asserts the structural facts (terms inside the card,
// banner/status/card order, merged status row) plus the static height
// budget: it reads the changed stylesheet values (the whitelist from the
// design's Req 2 table) and asserts the computed total ≤ 700 px. The
// static test guards against regressions; the real-phone screenshot is
// the authority for the true total.
// Pattern-fake data only: Test Customer, RCPT-12-202611-01.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderQuickCollectReceiptCardHtml } from '../nav-quick-collect.js';

const read = (name) => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const stylesSrc = read('styles.css');
const pageSrc = read('index.html');
const quickCollectSrc = read('nav-quick-collect.js');

// --- Structural facts ---

test('structure: the success step orders banner, status row, receipt card, then the below-fold blocks', () => {
  const step = pageSrc.indexOf('id="quickCollectStepSuccess"');
  assert.ok(step >= 0, 'success step missing');
  const order = [
    'class="qc-success-banner"',
    'class="qc-success-status-row"',
    'id="quickCollectReceiptCard"',
    'id="snsSuccessNextSteps"',
    'id="rptRepeatPayment"',
    'id="rsdReceiptShareDraft"',
    'id="sccSecondConnectionStep"',
    'class="qc-success-actions"',
  ];
  let last = step;
  for (const marker of order) {
    const at = pageSrc.indexOf(marker, last);
    assert.ok(at > last, `success step must contain ${marker} after the previous block`);
    last = at;
  }
});

test('structure: the merged status row wraps the still-owes line + the saved badge, after the pending-clearance flag', () => {
  const row = pageSrc.indexOf('class="qc-success-status-row"');
  assert.ok(row >= 0, 'status row missing');
  const flag = pageSrc.indexOf('id="pcfSuccessPendingClearanceFlag"');
  const stillOwes = pageSrc.indexOf('id="sowStillOwesLine"');
  const badge = pageSrc.indexOf('id="osbOfflineSavedBadge"');
  assert.ok(flag >= 0 && flag < row, 'pending-clearance flag must sit just before the status row');
  assert.ok(stillOwes > row, 'still-owes line must sit inside the status row');
  assert.ok(badge > stillOwes, 'saved badge must sit inside the status row, after the still-owes line');
  assert.ok(badge > row, 'saved badge must sit inside the status row');
  const rowClose = pageSrc.indexOf('</div>', badge);
  const card = pageSrc.indexOf('id="quickCollectReceiptCard"');
  assert.ok(rowClose >= 0 && rowClose < card, 'status row must close before the receipt card');
});

test('structure: the terms sit inside the receipt card (last block of the card)', () => {
  const receipt = {
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
  const html = renderQuickCollectReceiptCardHtml(receipt);
  assert.ok(html.includes('receipt-urdu-notice'), 'card must carry the terms block');
  const cardStart = html.indexOf('qc-receipt-card');
  const termsStart = html.indexOf('receipt-urdu-notice');
  const gridEnd = html.lastIndexOf('</div>', termsStart);
  assert.ok(cardStart >= 0 && termsStart > cardStart, 'terms must sit inside the receipt card');
  assert.ok(termsStart > html.indexOf('qc-receipt-grid'), 'terms must sit after the receipt grid');
});

test('structure: the still-owes line and the badge render into the row (the row collapses when both are empty)', () => {
  const rowRule = stylesSrc.indexOf('.qc-success-status-row');
  assert.ok(rowRule >= 0, 'status-row rule missing');
  assert.ok(stylesSrc.includes('.qc-success-status-row:not(:has(> :not([hidden])))'), 'row must hide when both children are hidden');
  assert.ok(stylesSrc.includes('.qc-success-status-row {') || stylesSrc.includes('.qc-success-status-row{'), 'row must be a flex row');
  const rowBlock = stylesSrc.slice(rowRule, stylesSrc.indexOf('}', rowRule));
  assert.ok(rowBlock.includes('display: flex'), 'row must be display:flex');
  assert.ok(rowBlock.includes('gap: 8px'), 'row gap must be 8px');
});

// --- Static height budget ---
// Baseline (design, screenshot-measured): the terms end at ≈955 CSS px.
// Each row below reads the changed stylesheet value and counts the
// design's saving. Design constants (H1, B3/M2, M1, S1, C3, C4, C5, T1)
// are PIL-measured or margin-collapse arithmetic from the design table;
// computed rows (H2, B1, B2, C1, C2, G1, D1) derive the saving from the
// before/after declared values.

function ruleBlock(css, selectorWithBrace) {
  const start = css.indexOf(selectorWithBrace);
  assert.ok(start >= 0, `missing rule ${selectorWithBrace}`);
  const open = css.indexOf('{', start);
  const close = css.indexOf('}', open);
  return css.slice(open + 1, close);
}

function firstPx(block, property) {
  const m = block.match(new RegExp(`${property}:\\s*([\\d.]+)px`));
  assert.ok(m, `missing ${property} in "${block.trim()}"`);
  return parseFloat(m[1]);
}

const BASELINE_PX = 955;
const TARGET_PX = 700;

test('fit budget: dialog top → end of receipt card ≤ 700 CSS px at 360 px width', () => {
  const savings = [];

  // H1 — eyebrow hidden on success (design constant 18: 10px line + 6px margin + rounding).
  assert.ok(stylesSrc.includes('#quickCollectModal.qc-success-open .modal-heading .eyebrow { display: none; }'), 'H1: eyebrow must hide on success');
  savings.push(['H1 eyebrow hidden', 18]);

  // H2 — header margin-bottom 12 → 8.
  const header = ruleBlock(stylesSrc, '#quickCollectModal.qc-success-open .modal-heading {');
  assert.ok(header.includes('margin-bottom: 8px'), 'H2: header margin-bottom must be 8px on success');
  savings.push(['H2 header margin 12→8', 12 - firstPx(header, 'margin-bottom')]);

  // B1 — hero check circle 48 → 40.
  const check = ruleBlock(stylesSrc, '#quickCollectModal.qc-success-open .qc-success-check {');
  assert.ok(check.includes('width: 40px') && check.includes('height: 40px'), 'B1: check circle must be 40px on success');
  savings.push(['B1 check 48→40', 48 - firstPx(check, 'width')]);

  // B2 — banner padding 16 → 10 vertical (top + bottom).
  const banner = ruleBlock(stylesSrc, '#quickCollectModal.qc-success-open .qc-success-banner {');
  assert.ok(banner.includes('padding: 10px 8px'), 'B2: banner padding must be 10px 8px on success');
  savings.push(['B2 banner padding 16→10', 2 * (16 - firstPx(banner, 'padding'))]);

  // B3 + M2 — heading explicit 18px + margin 0; message <p> margins → 0
  // (design constant 46: collapsed h3/p margins 54px → the check's 8px gap).
  const heading = ruleBlock(stylesSrc, '#quickCollectSuccessHeading {');
  assert.ok(heading.includes('font-size: 18px'), 'B3: heading must be explicit 18px');
  assert.ok(heading.includes('margin: 0'), 'B3: heading margin must be 0');
  const message = ruleBlock(stylesSrc, '#quickCollectSuccessMessage {');
  assert.ok(message.includes('margin: 0'), 'M2: message margins must be 0');
  savings.push(['B3/M2 heading + message margins → 0', 46]);

  // M1 — message Nastaliq 14px / line-height 2.0 (design measured 18: 3 lines × 28 vs 4 lines ≈ 102).
  const messageNastaliq = ruleBlock(stylesSrc, '#quickCollectSuccessMessage.qc-urdu-nastaliq {');
  assert.ok(messageNastaliq.includes('font-size: 14px'), 'M1: Urdu message must be 14px');
  const nastaliq = stylesSrc.slice(stylesSrc.indexOf('#quickCollectSuccessMessage.qc-urdu-nastaliq,'), stylesSrc.indexOf('}', stylesSrc.indexOf('#quickCollectSuccessMessage.qc-urdu-nastaliq,')));
  assert.ok(nastaliq.includes('line-height: 2.0'), 'M1: Nastaliq line-height must be 2.0');
  savings.push(['M1 message Nastaliq 14px/2.0', 18]);

  // S1 — still-owes + saved badge merged into one status row (design constant 40).
  assert.ok(stylesSrc.includes('.qc-success-status-row'), 'S1: status row must exist');
  const rowOwes = ruleBlock(stylesSrc, '#quickCollectModal.qc-success-open .qc-success-status-row .sow-still-owes {');
  assert.ok(rowOwes.includes('margin: 0'), 'S1: still-owes margin must be 0 inside the row');
  const rowBadge = ruleBlock(stylesSrc, '#quickCollectModal.qc-success-open .qc-success-status-row .osb-saved-badge {');
  assert.ok(rowBadge.includes('margin: 0'), 'S1: badge margin must be 0 inside the row');
  assert.ok(rowBadge.includes('padding: 8px 10px'), 'S1: badge padding must tighten to 8px 10px inside the row');
  savings.push(['S1 merged status row', 40]);

  // C1 — card padding 14 → 10 (top + bottom).
  const card = ruleBlock(stylesSrc, '#quickCollectModal.qc-success-open .qc-receipt-card {');
  assert.ok(card.includes('padding: 10px'), 'C1: card padding must be 10px on success');
  savings.push(['C1 card padding 14→10', 2 * (14 - firstPx(card, 'padding'))]);

  // C2 — card gap 10 → 8 (3 gaps between header / amount / grid / terms).
  assert.ok(card.includes('gap: 8px'), 'C2: card gap must be 8px on success');
  savings.push(['C2 card gap 10→8', 3 * (10 - firstPx(card, 'gap'))]);

  // C3 — card header badges stop wrapping (design constant 11: header ~47 → ≤36).
  assert.ok(stylesSrc.includes('#quickCollectModal.qc-success-open .qc-receipt-card .qc-receipt-header { flex-wrap: wrap; }'), 'C3: header must allow the id to drop to its own line');
  assert.ok(stylesSrc.includes('#quickCollectModal.qc-success-open .qc-receipt-card .qc-receipt-badge { white-space: nowrap; }'), 'C3: receipt badges must not wrap');
  assert.ok(stylesSrc.includes('#quickCollectModal.qc-success-open .qc-receipt-card .qc-receipt-id { white-space: nowrap; margin-left: auto; }'), 'C3: receipt id must not wrap and must right-align on its own line');
  savings.push(['C3 header badges stop wrapping', 11]);

  // C4 — amount 1.5rem → 1.3rem, row padding 4 → 2 (design constant 8).
  const amount = ruleBlock(stylesSrc, '#quickCollectModal.qc-success-open .qc-receipt-card .qc-receipt-amount {');
  assert.ok(amount.includes('font-size: 1.3rem'), 'C4: amount must be 1.3rem on success');
  const amountRow = ruleBlock(stylesSrc, '#quickCollectModal.qc-success-open .qc-receipt-card .qc-receipt-amount-row {');
  assert.ok(amountRow.includes('padding: 2px 0'), 'C4: amount row padding must be 2px 0 on success');
  savings.push(['C4 amount 1.5rem→1.3rem + row padding', 8]);

  // C5 — grid gap 8 → 6, Area select explicit height 34px (design constant 7).
  const grid = ruleBlock(stylesSrc, '#quickCollectModal.qc-success-open .qc-receipt-card .qc-receipt-grid {');
  assert.ok(grid.includes('gap: 6px'), 'C5: grid gap must be 6px on success');
  const areaSelect = ruleBlock(stylesSrc, '#quickCollectModal.qc-success-open .qc-receipt-card .qc-area-select {');
  assert.ok(areaSelect.includes('height: 34px'), 'C5: Area select must be 34px tall on success');
  savings.push(['C5 grid gap 8→6 + Area select 34px', 7]);

  // T1 — terms block 184 → 108 (design constant 76: margins 12 + padding 4 + <p> margins 36 + Nastaliq text 24).
  const terms = ruleBlock(stylesSrc, '#quickCollectModal.qc-success-open .qc-receipt-card .receipt-urdu-notice.qc-urdu-nastaliq {');
  assert.ok(terms.includes('margin: 10px 0'), 'T1: terms margin must be 10px 0 on success');
  assert.ok(terms.includes('padding: 8px 10px'), 'T1: terms padding must be 8px 10px on success');
  const termsP = ruleBlock(stylesSrc, '#quickCollectModal.qc-success-open .qc-receipt-card .receipt-urdu-notice.qc-urdu-nastaliq p {');
  assert.ok(termsP.includes('margin: 0'), 'T1: terms <p> margins must be 0 on success');
  savings.push(['T1 terms block 184→108', 76]);

  // G1 — step gap 12 → 8 (2 gaps between banner / status row / card).
  const step = ruleBlock(stylesSrc, '#quickCollectModal.qc-success-open #quickCollectStepSuccess {');
  assert.ok(step.includes('gap: 8px'), 'G1: success step gap must be 8px');
  savings.push(['G1 step gap 12→8', 2 * (12 - firstPx(step, 'gap'))]);

  // D1 — dialog padding-top 16 → 8 on success.
  const dialog = ruleBlock(stylesSrc, '#quickCollectModal.qc-success-open {');
  assert.ok(dialog.includes('padding-top: 8px'), 'D1: dialog padding-top must be 8px on success');
  savings.push(['D1 dialog padding-top 16→8', 16 - firstPx(dialog, 'padding-top')]);

  const totalSaved = savings.reduce((sum, [, value]) => sum + value, 0);
  const total = BASELINE_PX - totalSaved;
  assert.ok(
    total <= TARGET_PX,
    `fit budget: baseline ${BASELINE_PX}px − saved ${totalSaved}px = ${total}px must be ≤ ${TARGET_PX}px; savings: ${savings.map(([label, value]) => `${label} ${value}`).join(', ')}`
  );
  // The plan carries ~75px of slack against the worst case; guard it.
  assert.ok(totalSaved >= 202, `savings ${totalSaved}px must cover the ≈202px overshoot`);
});

test('fit guard: no success-scoped rule shrinks text below 11px', () => {
  const start = stylesSrc.indexOf('/* Polish 17');
  assert.ok(start >= 0, 'Polish 17 CSS block missing');
  const end = stylesSrc.indexOf('/* End Polish 17', start);
  assert.ok(end > start, 'Polish 17 CSS block must have an end marker');
  const block = stylesSrc.slice(start, end);
  const sizes = [...block.matchAll(/font-size:\s*([\d.]+)(px|rem)/g)];
  for (const [, value, unit] of sizes) {
    const px = unit === 'rem' ? parseFloat(value) * 16 : parseFloat(value);
    assert.ok(px >= 11, `Polish 17 must never shrink text below 11px, found font-size ${value}${unit}`);
  }
});

test('fit guard: the success-screen change rewords no text and drops no block', () => {
  // The heading, message, still-owes, badge, card and actions all stay.
  for (const id of ['quickCollectSuccessHeading', 'quickCollectSuccessMessage', 'sowStillOwesLine', 'osbOfflineSavedBadge', 'quickCollectReceiptCard', 'snsSuccessNextSteps', 'rptRepeatPayment', 'rsdReceiptShareDraft', 'sccSecondConnectionStep']) {
    assert.ok(pageSrc.includes(`id="${id}"`), `success step must keep #${id}`);
  }
  assert.ok(pageSrc.includes('Payment Recorded Successfully'), 'heading wording must stay');
  assert.ok(quickCollectSrc.includes("packageSuccessMessageOrDefault(amount)"), 'message source must stay the package message');
});
