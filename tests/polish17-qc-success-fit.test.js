// Polish 21 (Req 3 + Req 5) — BUDGET REWRITE of the polish #17 fit
// test: the Quick Collect success view fits one mobile screenshot —
// from the top of the dialog to the end of the receipt card (terms
// included) ≤ 700 CSS px at 360 px width, with no scrolling. The blocks
// below the card (next steps, repeat, share draft, second connection,
// actions) stay below the fold by design.
// The baseline is re-based on the PHONE-OBSERVED total (design RC3):
// polish #17's static 677 px under-read the phone by ~70 px (terms +24,
// header +9, message −28, residual uncertainty ~+62), so the true total
// was ≈745 px. The savings below are the polish #21 deltas only
// (T1-inline 42, SEP −8, NUM 24, S2 6 = 64), computed total 681 px,
// plus the tick-in-box fix's TICK-BOX −12 (row border + padding),
// computed total 693 px, plus the BUT HOUSE phone row's PHONE-ROW −43
// (one new grid row), computed total 736 px — 36 px OVER the 700 px
// gate, recorded in the budget test below, not blessed. The Month row
// (this fix) costs 0 px: it fills the lone-Remaining row, so the grid
// stays 3 rows in both shapes (Chromium 360 px: grid 156.2 px saved,
// 200.2 px no-phone, before AND after) and the computed total stays
// 736 px — no new overage.
// The polish #17 stylesheet values stay as regression guards (they no
// longer carry savings rows — the savings are the four deltas), except
// the three this polish changes (B1 inline tick, S1 compact badges +
// settle host, C3 header without the settle badge), which are updated
// in place. The static test guards against regressions; the real-phone
// screenshot is the authority for the true total.
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

test('structure: the merged status row wraps the still-owes line + the saved badge + the settle host, after the pending-clearance flag', () => {
  const row = pageSrc.indexOf('class="qc-success-status-row"');
  assert.ok(row >= 0, 'status row missing');
  const flag = pageSrc.indexOf('id="pcfSuccessPendingClearanceFlag"');
  const stillOwes = pageSrc.indexOf('id="sowStillOwesLine"');
  const badge = pageSrc.indexOf('id="osbOfflineSavedBadge"');
  const settle = pageSrc.indexOf('id="qcSettleStatusBadge"');
  assert.ok(flag >= 0 && flag < row, 'pending-clearance flag must sit just before the status row');
  assert.ok(stillOwes > row, 'still-owes line must sit inside the status row');
  assert.ok(badge > stillOwes, 'saved badge must sit inside the status row, after the still-owes line');
  assert.ok(settle > badge, 'settle host must sit inside the status row, after the saved badge (third pill)');
  assert.ok(settle > row, 'settle host must sit inside the status row');
  const rowClose = pageSrc.indexOf('</div>', settle);
  const card = pageSrc.indexOf('id="quickCollectReceiptCard"');
  assert.ok(rowClose >= 0 && rowClose < card, 'status row must close before the receipt card');
});

test('structure: the card header holds only the shared badge + the receipt id (the settle badge moved to the status section)', () => {
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
  const headerStart = html.indexOf('qc-receipt-header');
  assert.ok(headerStart >= 0, 'card header missing');
  const headerEnd = html.indexOf('</div>', headerStart);
  const header = html.slice(headerStart, headerEnd);
  assert.ok(!header.includes('Settle in Full'), 'card header must not carry the settle badge');
  assert.ok(!header.includes('Partial Payment'), 'card header must not carry the partial badge');
  assert.ok(header.includes('badge-receipt-unshared') || header.includes('badge-receipt-shared'), 'card header must keep the shared badge');
  assert.ok(header.includes('RCPT-12-202611-01'), 'card header must keep the receipt id');
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
// Baseline (design RC3, phone-observed): the terms end at ≈745 CSS px.
// The savings below are the polish #21 deltas only. The polish #17
// stylesheet values are regression guards — they no longer carry
// savings rows.

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

const BASELINE_PX = 745;
const TARGET_PX = 700;
// The fold on the user's phone is ≈712 px; the observed overshoot is
// BASELINE_PX − 712 = 33 px, which the savings must cover.
const FOLD_PX = 712;

test('fit budget: dialog top → end of receipt card ≤ 700 CSS px at 360 px width', () => {
  const savings = [];

  // --- Polish #17 regression guards (values stay, savings no longer
  // counted here — the savings are the four polish #21 deltas below).
  // H1 — eyebrow hidden on success.
  assert.ok(stylesSrc.includes('#quickCollectModal.qc-success-open .modal-heading .eyebrow { display: none; }'), 'H1: eyebrow must hide on success');

  // H2 — header margin-bottom 12 → 8.
  const header = ruleBlock(stylesSrc, '#quickCollectModal.qc-success-open .modal-heading {');
  assert.ok(header.includes('margin-bottom: 8px'), 'H2: header margin-bottom must be 8px on success');

  // B2 — banner padding 16 → 10 vertical (top + bottom).
  const banner = ruleBlock(stylesSrc, '#quickCollectModal.qc-success-open .qc-success-banner {');
  assert.ok(banner.includes('padding: 10px 8px'), 'B2: banner padding must be 10px 8px on success');

  // B3 + M2 — heading explicit 18px + margin 0; message <p> margins → 0.
  const heading = ruleBlock(stylesSrc, '#quickCollectSuccessHeading {');
  assert.ok(heading.includes('font-size: 18px'), 'B3: heading must be explicit 18px');
  assert.ok(heading.includes('margin: 0'), 'B3: heading margin must be 0');
  const message = ruleBlock(stylesSrc, '#quickCollectSuccessMessage {');
  assert.ok(message.includes('margin: 0'), 'M2: message margins must be 0');

  // M1 — message Nastaliq 14px / line-height 2.0.
  const messageNastaliq = ruleBlock(stylesSrc, '#quickCollectSuccessMessage.qc-urdu-nastaliq {');
  assert.ok(messageNastaliq.includes('font-size: 14px'), 'M1: Urdu message must be 14px');
  const nastaliq = stylesSrc.slice(stylesSrc.indexOf('#quickCollectSuccessMessage.qc-urdu-nastaliq,'), stylesSrc.indexOf('}', stylesSrc.indexOf('#quickCollectSuccessMessage.qc-urdu-nastaliq,')));
  assert.ok(nastaliq.includes('line-height: 2.0'), 'M1: Nastaliq line-height must be 2.0');

  // C1 — card padding 14 → 10 (top + bottom).
  const card = ruleBlock(stylesSrc, '#quickCollectModal.qc-success-open .qc-receipt-card {');
  assert.ok(card.includes('padding: 10px'), 'C1: card padding must be 10px on success');

  // C2 — card gap 10 → 8.
  assert.ok(card.includes('gap: 8px'), 'C2: card gap must be 8px on success');

  // C3 — card header badges stop wrapping; the receipt id drops to its
  // own right-aligned line only if it cannot fit.
  assert.ok(stylesSrc.includes('#quickCollectModal.qc-success-open .qc-receipt-card .qc-receipt-header { flex-wrap: wrap; }'), 'C3: header must allow the id to drop to its own line');
  assert.ok(stylesSrc.includes('#quickCollectModal.qc-success-open .qc-receipt-card .qc-receipt-badge { white-space: nowrap; }'), 'C3: receipt badges must not wrap');
  assert.ok(stylesSrc.includes('#quickCollectModal.qc-success-open .qc-receipt-card .qc-receipt-id { white-space: nowrap; margin-left: auto; }'), 'C3: receipt id must not wrap and must right-align on its own line');

  // C4 — amount 1.5rem → 1.3rem, row padding 4 → 2.
  const amount = ruleBlock(stylesSrc, '#quickCollectModal.qc-success-open .qc-receipt-card .qc-receipt-amount {');
  assert.ok(amount.includes('font-size: 1.3rem'), 'C4: amount must be 1.3rem on success');
  const amountRow = ruleBlock(stylesSrc, '#quickCollectModal.qc-success-open .qc-receipt-card .qc-receipt-amount-row {');
  assert.ok(amountRow.includes('padding: 2px 0'), 'C4: amount row padding must be 2px 0 on success');

  // C5 — grid gap 8 → 6, Area select explicit height 34px.
  const grid = ruleBlock(stylesSrc, '#quickCollectModal.qc-success-open .qc-receipt-card .qc-receipt-grid {');
  assert.ok(grid.includes('gap: 6px'), 'C5: grid gap must be 6px on success');
  const areaSelect = ruleBlock(stylesSrc, '#quickCollectModal.qc-success-open .qc-receipt-card .qc-area-select {');
  assert.ok(areaSelect.includes('height: 34px'), 'C5: Area select must be 34px tall on success');

  // T1 — terms block (margins, padding, <p> margins).
  const terms = ruleBlock(stylesSrc, '#quickCollectModal.qc-success-open .qc-receipt-card .receipt-urdu-notice.qc-urdu-nastaliq {');
  assert.ok(terms.includes('margin: 10px 0'), 'T1: terms margin must be 10px 0 on success');
  assert.ok(terms.includes('padding: 8px 10px'), 'T1: terms padding must be 8px 10px on success');
  const termsP = ruleBlock(stylesSrc, '#quickCollectModal.qc-success-open .qc-receipt-card .receipt-urdu-notice.qc-urdu-nastaliq p {');
  assert.ok(termsP.includes('margin: 0'), 'T1: terms <p> margins must be 0 on success');

  // G1 — step gap 12 → 8.
  const step = ruleBlock(stylesSrc, '#quickCollectModal.qc-success-open #quickCollectStepSuccess {');
  assert.ok(step.includes('gap: 8px'), 'G1: success step gap must be 8px');

  // D1 — dialog padding-top 16 → 8 on success.
  const dialog = ruleBlock(stylesSrc, '#quickCollectModal.qc-success-open {');
  assert.ok(dialog.includes('padding-top: 8px'), 'D1: dialog padding-top must be 8px on success');

  // --- Polish #21 deltas (design Req 3 table) ---
  // T1-inline — hero tick row gone (check 40px + 8px margin removed),
  // heading row grows 22 → 28px (+6). Net 48 − 6 = 42. The tick-in-box
  // fix grows the tick 28 → 32px, but the row height is still driven by
  // the ~54px two-line heading, so the +6 (and the 42) are unchanged.
  const check = ruleBlock(stylesSrc, '#quickCollectModal.qc-success-open .qc-success-check {');
  assert.ok(check.includes('width: 32px') && check.includes('height: 32px'), 'T1-inline: inline tick must be 32px on success');
  assert.ok(pageSrc.includes('<div class="qc-success-heading-row">'), 'T1-inline: tick must live in the heading row');
  assert.equal((pageSrc.match(/class="qc-success-check"/g) || []).length, 1, 'T1-inline: no hero tick row may remain');
  savings.push(['T1-inline tick inline (hero row gone)', 42]);

  // SEP — separation: message margin-top 0 → 8px. A cost, booked negative.
  const successMessage = ruleBlock(stylesSrc, '#quickCollectModal.qc-success-open #quickCollectSuccessMessage {');
  assert.ok(successMessage.includes('margin-top: 8px'), 'SEP: message margin-top must be 8px on success');
  savings.push(['SEP separation margin-top 0→8', -8]);

  // TICK-BOX — tick-in-box fix: the heading row gains a permanent 2px
  // border + 4px padding (2×2 + 4×2 = +12px). A cost, booked negative.
  // Total becomes 745 − (42 − 8 + 24 + 6 − 12) = 693px, inside the gate.
  const headingRow = ruleBlock(stylesSrc, '.qc-success-heading-row {');
  assert.ok(headingRow.includes('border: 2px solid var(--green, #0e5b4d)'), 'TICK-BOX: row must carry the 2px green border');
  assert.ok(headingRow.includes('border-radius: 12px'), 'TICK-BOX: row border radius must be 12px');
  assert.ok(headingRow.includes('padding: 4px 12px'), 'TICK-BOX: row padding must be 4px 12px');
  savings.push(['TICK-BOX row border + padding', -12]);

  // NUM — support number nowrap: support line 2 → 1 line.
  assert.ok(stylesSrc.includes('.receipt-support-number { white-space: nowrap; }'), 'NUM: support number must be nowrap');
  savings.push(['NUM support number nowrap (2→1 line)', 24]);

  // S2 — status merge, compact badges: status + header 85 → 79px.
  const rowOwes = ruleBlock(stylesSrc, '#quickCollectModal.qc-success-open .qc-success-status-row .sow-still-owes {');
  assert.ok(rowOwes.includes('margin: 0'), 'S2: still-owes margin must be 0 inside the row');
  assert.ok(rowOwes.includes('font-size: 12px'), 'S2: still-owes must demote to 12px (compact badges)');
  assert.ok(rowOwes.includes('padding: 2px 8px'), 'S2: still-owes padding must tighten to 2px 8px inside the row');
  const rowBadge = ruleBlock(stylesSrc, '#quickCollectModal.qc-success-open .qc-success-status-row .osb-saved-badge {');
  assert.ok(rowBadge.includes('margin: 0'), 'S2: badge margin must be 0 inside the row');
  assert.ok(rowBadge.includes('padding: 2px 8px'), 'S2: badge padding must tighten to 2px 8px inside the row');
  assert.ok(pageSrc.includes('id="qcSettleStatusBadge"'), 'S2: settle host must sit in the status section');
  savings.push(['S2 merged status section, compact badges', 6]);

  // PHONE-ROW — BUT HOUSE fix: the success card gains a "Mobile Number"
  // row after the Customer row (a half-width grid item, label above
  // value). The grid goes from 4 items (2 rows) to 5 (3 rows), so the
  // card grows by one row: label + value + one success grid gap =
  // 17.28 + 19.68 + 6 = 42.96px, rounded to 43px — measured in Chromium
  // at 360px (grid 113.2 → 156.2px, card 356.4 → 399.4px). A cost,
  // booked negative. Total becomes 745 − (42 − 8 − 12 + 24 + 6 − 43) =
  // 736px, 36px OVER the 700px gate. This test RECORDS that overage;
  // it does not bless it. Worst case, when no number is saved and the
  // "Add number" button shows (label + "Not saved" + 44px button =
  // ~81px row), the grid grows ~87px and the total computes to ~780px.
  // The phone screenshot is the authority for the true total, and the
  // polish #21 reserve knobs recover the 36px if the user wants the
  // card back under 700 — none of them is applied here, per the plan:
  // nothing else is silently shrunk to compensate.
  const phoneHtml = renderQuickCollectReceiptCardHtml({
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
  });
  const phoneAt = phoneHtml.indexOf('Mobile Number');
  assert.ok(phoneAt >= 0, 'PHONE-ROW: card must carry the Mobile Number row');
  const phoneRowStart = phoneHtml.lastIndexOf('<div class="qc-receipt-item', phoneAt);
  const phoneRowTag = phoneHtml.slice(phoneRowStart, phoneHtml.indexOf('>', phoneRowStart) + 1);
  assert.ok(!phoneRowTag.includes('full-width'), 'PHONE-ROW: the row is a half-width grid item, not a full-width row');
  const phoneLabelBlock = ruleBlock(stylesSrc, '.qc-meta-label {');
  const phoneGridBlock = ruleBlock(stylesSrc, '.qc-receipt-grid {');
  const phoneBodyBlock = ruleBlock(stylesSrc, 'body {');
  const phoneLineHeight = parseFloat(phoneBodyBlock.match(/line-height:\s*([\d.]+)/)[1]);
  const phoneLabelPx = parseFloat(phoneLabelBlock.match(/font-size:\s*([\d.]+)rem/)[1]) * 16 * phoneLineHeight;
  const phoneValuePx = parseFloat(phoneGridBlock.match(/font-size:\s*([\d.]+)rem/)[1]) * 16 * phoneLineHeight;
  const phoneRowCostPx = Math.round(phoneLabelPx + phoneValuePx + 6);
  assert.equal(phoneRowCostPx, 43, `PHONE-ROW: one new grid row must cost 43px (label ${phoneLabelPx}px + value ${phoneValuePx}px + gap 6px)`);
  savings.push(['PHONE-ROW Mobile Number row (one new grid row)', -phoneRowCostPx]);

  // MONTH-ROW — this fix: the card gains a "Month" row after Date &
  // Method (a half-width grid item, label above value). The grid goes
  // from 5 half-width items (3 rows: the Remaining Balance row stands
  // alone) to 6 (still 3 rows — the Month row fills that lone row), so
  // the card grows by 0px. Measured in Chromium at 360px on the real
  // fixed sources (harness ~/workspace/qc-month-name-repro/, 0
  // pageerrors): grid 156.2px and card 399.4px phone-saved, grid
  // 200.2px and card 443.4px no-phone — identical before and after in
  // both shapes. A cost of 0px, booked as such; the computed total
  // stays 736px and the 36px overage recorded by PHONE-ROW is unchanged.
  const monthHtml = renderQuickCollectReceiptCardHtml({
    id: 'receipt-12',
    receiptNumber: 'RCPT-12-202611-01',
    amount: 1000,
    customerName: 'Test Customer',
    customerNumber: 12,
    date: '2026-11-08',
    month: '2026-11',
    method: 'Easypaisa',
    area: 'Sodaa',
    payableRemaining: 0,
    newTotalDues: 0,
  });
  const monthAt = monthHtml.indexOf('>Month<');
  assert.ok(monthAt >= 0, 'MONTH-ROW: card must carry the Month row for a 2026-11 bill');
  const monthRowStart = monthHtml.lastIndexOf('<div class="qc-receipt-item', monthAt);
  const monthRowTag = monthHtml.slice(monthRowStart, monthHtml.indexOf('>', monthRowStart) + 1);
  assert.ok(!monthRowTag.includes('full-width'), 'MONTH-ROW: the row is a half-width grid item, not a full-width row');
  assert.ok(monthHtml.indexOf('Date &amp; Method') < monthAt, 'MONTH-ROW: Month row must sit after Date & Method');
  assert.ok(monthAt < monthHtml.indexOf('Area / Location'), 'MONTH-ROW: Month row must sit before Area / Location');
  assert.ok(monthHtml.includes('>November<'), 'MONTH-ROW: Month row must read November');
  // (The phone row carries a data-qc-receipt-phone attribute, so the
  // half-width count matches the class prefix and subtracts full-width
  // rows instead of matching the bare `>` form.)
  const halfWidth = (html) => {
    const all = (html.match(/<div class="qc-receipt-item/g) || []).length;
    const full = (html.match(/<div class="qc-receipt-item full-width/g) || []).length;
    return all - full;
  };
  const rowsBefore = Math.ceil(halfWidth(phoneHtml) / 2);
  const rowsAfter = Math.ceil(halfWidth(monthHtml) / 2);
  assert.equal(halfWidth(monthHtml), 6, 'MONTH-ROW: six half-width grid items with the Month row');
  assert.equal(rowsBefore, 3, 'MONTH-ROW: five half-width items already made 3 rows (Remaining stood alone)');
  assert.equal(rowsAfter, 3, 'MONTH-ROW: six half-width items still make 3 rows — the Month row fills the lone row');
  assert.equal(rowsAfter - rowsBefore, 0, 'MONTH-ROW: the Month row adds no grid row, so it costs 0px');
  savings.push(['MONTH-ROW Month row (fills lone-Remaining row)', 0]);

  const totalSaved = savings.reduce((sum, [, value]) => sum + value, 0);
  const total = BASELINE_PX - totalSaved;
  // PHONE-ROW overage (recorded, not blessed): the user-asked Mobile
  // Number row pushes the computed total to 736px, 36px over the gate.
  // The static test guards against regressions; the real-phone
  // screenshot is the authority for the true total.
  assert.equal(totalSaved, 9, `savings must be 9px (42 − 8 − 12 + 24 + 6 − 43 + 0), got ${totalSaved}px`);
  assert.equal(total, 736, `fit budget: computed total must be 736px (baseline ${BASELINE_PX}px − saved ${totalSaved}px)`);
  assert.ok(
    total > TARGET_PX,
    `fit budget: the computed total ${total}px is ${total - TARGET_PX}px OVER the ${TARGET_PX}px gate — recorded here (BUT HOUSE phone row), to be confirmed by the phone screenshot`,
  );
  // The savings no longer cover the observed overshoot over the phone
  // fold (33px): 9px of saving against a 33px overshoot. Recorded,
  // not waived — the polish #21 reserve knobs recover it if the user
  // wants the card back under 700.
});

test('fit guard: no success-scoped rule shrinks text below 11px', () => {
  // Note the Polish 21 start marker is the block header, not the bare
  // '/* Polish 21' — in-place Polish 21 comments sit earlier in the
  // sheet (the Req 4 nowrap rule), so the bare marker would slice
  // thousands of unrelated lines into the scan.
  for (const [startMarker, endMarker] of [['/* Polish 17', '/* End Polish 17'], ['/* Polish 21 — Quick Collect', '/* End Polish 21']]) {
    const start = stylesSrc.indexOf(startMarker);
    assert.ok(start >= 0, `${startMarker} CSS block missing`);
    const end = stylesSrc.indexOf(endMarker, start);
    assert.ok(end > start, `${startMarker} CSS block must have an end marker`);
    const block = stylesSrc.slice(start, end);
    const sizes = [...block.matchAll(/font-size:\s*([\d.]+)(px|rem)/g)];
    for (const [, value, unit] of sizes) {
      const px = unit === 'rem' ? parseFloat(value) * 16 : parseFloat(value);
      assert.ok(px >= 11, `${startMarker} must never shrink text below 11px, found font-size ${value}${unit}`);
    }
  }
});

test('fit guard: the success-screen change rewords no text and drops no block', () => {
  // The heading, message, still-owes, badge, settle host, card and actions all stay.
  for (const id of ['quickCollectSuccessHeading', 'quickCollectSuccessMessage', 'sowStillOwesLine', 'osbOfflineSavedBadge', 'qcSettleStatusBadge', 'quickCollectReceiptCard', 'snsSuccessNextSteps', 'rptRepeatPayment', 'rsdReceiptShareDraft', 'sccSecondConnectionStep']) {
    assert.ok(pageSrc.includes(`id="${id}"`), `success step must keep #${id}`);
  }
  assert.ok(pageSrc.includes('Payment Recorded Successfully'), 'heading wording must stay');
  assert.ok(pageSrc.includes('class="qc-success-heading-row"'), 'heading-row wrapper must exist');
  assert.ok(quickCollectSrc.includes("packageSuccessMessageOrDefault(amount)"), 'message source must stay the package message');
});
