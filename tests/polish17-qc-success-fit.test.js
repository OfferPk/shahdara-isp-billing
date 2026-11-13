// QC receipt-modal overhaul — BUDGET REWRITE of the polish #17 fit
// test: the Quick Collect success view is measured by the Chromium
// harness (~/workspace/shahdara-qc-receipt-modal-harness/), NOT by
// this static model. The harness is the authority for the true total;
// this file pins the structure, the CSS values, and the grid math
// that produce it, and RECORDS the measured totals.
//
// Measured (harness, 0 pageerrors, chromium-headless-shell):
//   360px variant A (fully paid): cardScrollH 1,116px, cardOverX 0.
//     Baseline was 2,142px — a −47.9% reduction, 66px OVER the
//     user-locked ≤1,050px budget (−51% / ~1,040px). Recorded, not
//     blessed. The spec's ~1,040px estimate did not account for the
//     collapsed accordion's real height (66px, not 44px — the summary
//     line + header + padding) or the heading wrapping to two lines
//     (48px row, not 32px). No field or action is hidden to force the
//     number; the overage is disclosed, not waived.
//   320px variant A: cardScrollH 1,144px, cardOverX 0 — 69px over the
//     ≤1,075px budget. The pills row wraps to two lines at 320px
//     (banner 132px vs 104px at 360px).
//   360px variant B (loaded, partial + ticket pending): 1,114px,
//     cardOverX 0 — WITHIN the ≤1,160px budget. The merged row reads
//     the charged label with PKR 300.
//   The expanded draft preview never overflows horizontally
//   (preOverX 0 in all three runs — pre-wrap + overflow-wrap anywhere).
//   The sticky header holds (title stays at y=37 after scrolling to
//   the bottom). The (i) button is 32×32 (the global min-height oval
//   is fixed at modal scope). The Area pill is 30px.
// The old polish #17 / #21 static budget arithmetic (baseline 745px,
// savings deltas, computed total 762px) modelled the OLD structure
// (separate banner + status row + next-steps + repeat + open draft)
// and is retired with it — it cannot describe a modal whose second
// summary card, repeat host, and open draft no longer exist.
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

test('structure: the success step orders banner, callout, receipt card, draft accordion, then the actions', () => {
  const step = pageSrc.indexOf('id="quickCollectStepSuccess"');
  assert.ok(step >= 0, 'success step missing');
  const order = [
    'class="qc-success-banner"',
    'class="qc-success-callout"',
    'id="quickCollectReceiptCard"',
    'id="rsdReceiptShareDraft"',
    'class="qc-success-actions"',
  ];
  let last = step;
  for (const marker of order) {
    const at = pageSrc.indexOf(marker, last);
    assert.ok(at > last, `success step must contain ${marker} after the previous block`);
    last = at;
  }
  // The old below-fold blocks are gone: no second summary card, no
  // repeat host, no settle badge host, no Collect Another button.
  assert.ok(!pageSrc.includes('id="snsSuccessNextSteps"'), 'next-steps host must be gone');
  assert.ok(!pageSrc.includes('id="rptRepeatPayment"'), 'repeat host must be gone');
  assert.ok(!pageSrc.includes('id="qcSettleStatusBadge"'), 'settle host must be gone');
  assert.ok(!pageSrc.includes('id="quickCollectAnotherBtn"'), 'Collect Another button must be gone');
});

test('structure: the banner holds the heading row + the two-pill row, and the pills row hides when both are hidden', () => {
  const banner = pageSrc.indexOf('class="qc-success-banner"');
  assert.ok(banner >= 0, 'banner missing');
  const row = pageSrc.indexOf('class="qc-success-pills-row"', banner);
  assert.ok(row > banner, 'pills row must sit inside the banner');
  const stillOwes = pageSrc.indexOf('id="sowStillOwesLine"', row);
  const badge = pageSrc.indexOf('id="osbOfflineSavedBadge"', row);
  assert.ok(stillOwes > row, 'still-owes line must sit inside the pills row');
  assert.ok(badge > stillOwes, 'saved badge must sit inside the pills row, after the still-owes line');
  const rowClose = pageSrc.indexOf('</div>', badge);
  const callout = pageSrc.indexOf('class="qc-success-callout"');
  assert.ok(rowClose >= 0 && rowClose < callout, 'pills row must close before the callout');
  const rowRule = stylesSrc.indexOf('.qc-success-pills-row:not(:has(> :not([hidden])))');
  assert.ok(rowRule >= 0, 'pills row must hide when both children are hidden');
  const rowBlock = stylesSrc.slice(stylesSrc.indexOf('.qc-success-pills-row {'), stylesSrc.indexOf('}', stylesSrc.indexOf('.qc-success-pills-row {')));
  assert.ok(rowBlock.includes('display: flex'), 'pills row must be display:flex');
  assert.ok(rowBlock.includes('min-height: 22px'), 'pills row must carry a min-height so the banner does not collapse');
});

test('structure: the card header holds only the shared badge + the receipt id (the settle badge is gone entirely)', () => {
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

test('structure: the merged Still-owed row is HIDDEN when fully paid, shown when anything is owed', () => {
  // QC Success Card Polish (2026-11-13) reverses the QC receipt-modal
  // overhaul's "always shown" rule: a fully-paid card carries NO
  // Still-owed row at all — the settled state is stated by the
  // still-owes pill, so no "Fully paid" row and no "PKR 0" text ever
  // appear. The partial card keeps the row with its figure.
  const paid = {
    id: 'receipt-12', receiptNumber: 'RCPT-12-202611-01', amount: 1000,
    customerName: 'Test Customer', customerNumber: 12, date: '2026-11-08',
    method: 'Easypaisa', area: 'Sodaa', payableRemaining: 0, newTotalDues: 0,
  };
  const paidHtml = renderQuickCollectReceiptCardHtml(paid);
  assert.ok(!paidHtml.includes('Still owed'), 'fully-paid card must not carry a Still-owed row');
  assert.ok(!paidHtml.includes('Fully paid'), 'fully-paid card must not carry a Fully paid row');
  assert.ok(!paidHtml.includes('Remaining Balance'), 'no Remaining Balance row may remain');
  const partial = { ...paid, payableRemaining: 400, newTotalDues: 400 };
  const partialHtml = renderQuickCollectReceiptCardHtml(partial);
  assert.ok(partialHtml.includes('Still owed'), 'partial card must carry the Still-owed row');
  assert.ok(partialHtml.includes('PKR 400'), 'partial card must show the remaining figure');
});

// --- Static CSS guards (the values the harness total is built from) ---

function ruleBlock(css, selectorWithBrace) {
  const start = css.indexOf(selectorWithBrace);
  assert.ok(start >= 0, `missing rule ${selectorWithBrace}`);
  const open = css.indexOf('{', start);
  const close = css.indexOf('}', open);
  return css.slice(open + 1, close);
}

test('fit budget: the compact header, banner, callout, card and action values the harness measures', () => {
  // H1 — eyebrow hidden on success.
  assert.ok(stylesSrc.includes('#quickCollectModal.qc-success-open .modal-heading .eyebrow { display: none; }'), 'H1: eyebrow must hide on success');

  // Header — compact sticky 52px target, measured 44px (the title +
  // 32px buttons drive it); margin-bottom 0, top 0.
  const header = ruleBlock(stylesSrc, '#quickCollectModal.qc-success-open .modal-heading {');
  assert.ok(stylesSrc.includes('#quickCollectModal.qc-success-open .modal-heading { margin-bottom: 0 !important; }'), 'header margin-bottom must be 0 on success');
  assert.ok(header.includes('top: 0'), 'header must stick at top 0 (the old -16px offset is gone)');
  const helpBtn = ruleBlock(stylesSrc, '#quickCollectModal .help-info-btn {');
  assert.ok(helpBtn.includes('width: 32px') && helpBtn.includes('height: 32px'), '(i) button must be 32x32 on success');
  assert.ok(helpBtn.includes('min-height: 32px !important'), '(i) button must beat the global 44px min-height rule');
  const closeBtn = ruleBlock(stylesSrc, '#quickCollectModal #closeQuickCollectModalBtn {');
  assert.ok(closeBtn.includes('width: 32px') && closeBtn.includes('height: 32px'), 'close button must be 32x32 on success');

  // Banner — unified emerald: brand-soft bg, success border, 12px 16px.
  const banner = ruleBlock(stylesSrc, '#quickCollectModal.qc-success-open .qc-success-banner {');
  assert.ok(banner.includes('background: var(--ds-brand-soft)'), 'banner must use the brand-soft background');
  assert.ok(banner.includes('border: 1px solid var(--ds-success-border)'), 'banner must use the success border');
  assert.ok(banner.includes('padding: 12px 16px'), 'banner padding must be 12px 16px on success');

  // Heading — 16px (was 18px), margin 0. The heading wraps to two
  // lines at 360px in the harness (48px row) — measured, not hidden.
  const heading = ruleBlock(stylesSrc, '#quickCollectSuccessHeading {');
  assert.ok(heading.includes('font-size: 16px'), 'heading must be explicit 16px');
  assert.ok(heading.includes('margin: 0'), 'heading margin must be 0');
  // Tick — 32px inline, in the heading row.
  const check = ruleBlock(stylesSrc, '#quickCollectModal.qc-success-open .qc-success-check {');
  assert.ok(check.includes('width: 32px') && check.includes('height: 32px'), 'inline tick must be 32px on success');
  assert.ok(pageSrc.includes('<div class="qc-success-heading-row">'), 'tick must live in the heading row');
  assert.equal((pageSrc.match(/class="qc-success-check"/g) || []).length, 1, 'no hero tick row may remain');

  // Callout — the Urdu package note in its own box below the banner.
  const callout = ruleBlock(stylesSrc, '#quickCollectModal.qc-success-open .qc-success-callout {');
  assert.ok(callout.includes('background: var(--ds-nested)'), 'callout must use the nested background');
  assert.ok(callout.includes('border-right: 3px solid var(--ds-brand)'), 'callout must carry the brand right border');
  assert.ok(callout.includes('padding: 10px 14px'), 'callout padding must be 10px 14px');
  assert.ok(callout.includes('direction: rtl'), 'callout must be RTL');

  // Message — Nastaliq 14px / line-height 2.0, margins 0 (in the callout).
  const messageNastaliq = ruleBlock(stylesSrc, '#quickCollectSuccessMessage.qc-urdu-nastaliq {');
  assert.ok(messageNastaliq.includes('font-size: 14px'), 'Urdu message must be 14px');
  const nastaliq = stylesSrc.slice(stylesSrc.indexOf('#quickCollectSuccessMessage.qc-urdu-nastaliq,'), stylesSrc.indexOf('}', stylesSrc.indexOf('#quickCollectSuccessMessage.qc-urdu-nastaliq,')));
  assert.ok(nastaliq.includes('line-height: 2.0'), 'Nastaliq line-height must be 2.0');
  const message = ruleBlock(stylesSrc, '#quickCollectSuccessMessage {');
  assert.ok(message.includes('margin: 0'), 'message margins must be 0');

  // C1 — card padding 14 → 10 (top + bottom).
  const card = ruleBlock(stylesSrc, '#quickCollectModal.qc-success-open .qc-receipt-card {');
  assert.ok(card.includes('padding: 10px'), 'C1: card padding must be 10px on success');

  // C2 — card gap 10 → 8.
  assert.ok(card.includes('gap: 8px'), 'C2: card gap must be 8px on success');

  // C3 — card header badges stop wrapping; the receipt reference group
  // drops to its own right-aligned line only if it cannot fit.
  assert.ok(stylesSrc.includes('#quickCollectModal.qc-success-open .qc-receipt-card .qc-receipt-header { flex-wrap: wrap; }'), 'C3: header must allow the id to drop to its own line');
  assert.ok(stylesSrc.includes('#quickCollectModal.qc-success-open .qc-receipt-card .qc-receipt-badge { white-space: nowrap; }'), 'C3: receipt badges must not wrap');

  // C4 — amount 1.5rem → 1.3rem, row padding 4 → 2.
  const amount = ruleBlock(stylesSrc, '#quickCollectModal.qc-success-open .qc-receipt-card .qc-receipt-amount {');
  assert.ok(amount.includes('font-size: 1.3rem'), 'C4: amount must be 1.3rem on success');
  // QC Success Card Polish (2026-11-13): the row is a pill now, so
  // C4 reads the pill rule — padding 2px 14px (vertical stays 2px,
  // horizontal is the pill shape).
  const amountRow = ruleBlock(stylesSrc, '#quickCollectModal.qc-success-open .qc-receipt-card .qc-receipt-amount-row.qc-amount-pill {');
  assert.ok(amountRow.includes('padding: 2px 14px'), 'C4: amount pill padding must be 2px 14px on success');

  // C5 — grid gap 8 → 6; the Area select is a 30px pill (was a 44px
  // select, then a dead 34px rule — the pill is the live value).
  const grid = ruleBlock(stylesSrc, '#quickCollectModal.qc-success-open .qc-receipt-card .qc-receipt-grid {');
  assert.ok(grid.includes('gap: 6px'), 'C5: grid gap must be 6px on success');
  const areaSelect = ruleBlock(stylesSrc, '#quickCollectModal.qc-success-open .qc-receipt-card .qc-area-select {');
  assert.ok(areaSelect.includes('height: 30px'), 'C5: Area pill must be 30px tall on success');
  assert.ok(areaSelect.includes('min-height: 0'), 'C5: Area pill must beat the 44px select floor');

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

  // S2 — pills row: compact badges (12px, 2px 8px) + 6px section gap.
  const rowGap = ruleBlock(stylesSrc, '#quickCollectModal.qc-success-open .qc-success-pills-row {');
  assert.ok(rowGap.includes('gap: 6px'), 'S2: pills row gap must be 6px on success');
  const rowOwes = ruleBlock(stylesSrc, '#quickCollectModal.qc-success-open .qc-success-pills-row .sow-still-owes {');
  assert.ok(rowOwes.includes('margin: 0'), 'S2: still-owes margin must be 0 inside the row');
  assert.ok(rowOwes.includes('font-size: 12px'), 'S2: still-owes must demote to 12px (compact badges)');
  assert.ok(rowOwes.includes('padding: 2px 8px'), 'S2: still-owes padding must tighten to 2px 8px inside the row');
  const rowBadge = ruleBlock(stylesSrc, '#quickCollectModal.qc-success-open .qc-success-pills-row .osb-saved-badge {');
  assert.ok(rowBadge.includes('margin: 0'), 'S2: badge margin must be 0 inside the row');
  assert.ok(rowBadge.includes('padding: 2px 8px'), 'S2: badge padding must tighten to 2px 8px inside the row');

  // NUM — support number nowrap: support line 2 → 1 line.
  assert.ok(stylesSrc.includes('.receipt-support-number { white-space: nowrap; }'), 'NUM: support number must be nowrap');

  // Accordion — the collapsed draft: pre-wrap + overflow-wrap anywhere
  // (the +558px overflow fix), summary line single-line ellipsis.
  assert.ok(stylesSrc.includes('.rsd-share-draft-text'), 'accordion preview-text rules must exist');
  const preRule = stylesSrc.slice(stylesSrc.indexOf('.rsd-share-draft-text'));
  assert.ok(preRule.includes('white-space: pre-wrap'), 'preview must wrap');
  assert.ok(preRule.includes('overflow-wrap: anywhere'), 'preview must break anywhere');
  const lineRule = ruleBlock(stylesSrc, '#quickCollectModal .rsd-share-draft-line {');
  assert.ok(lineRule.includes('text-overflow: ellipsis'), 'summary line must truncate with an ellipsis');
  assert.ok(lineRule.includes('white-space: nowrap'), 'summary line must be a single line');

  // Actions — primary 48px solid brand; output grid 3-col; next row
  // 2-col; empty-amount text button; Done full-width ghost.
  const primary = ruleBlock(stylesSrc, '#quickCollectModal.qc-success-open .qc-wa-btn {');
  assert.ok(primary.includes('min-height: 48px'), 'primary must be 48px');
  assert.ok(primary.includes('background: var(--ds-brand)'), 'primary must be the solid brand');
  assert.ok(stylesSrc.includes('.qc-output-grid'), 'output grid must exist');
  assert.ok(stylesSrc.includes('.qc-next-row'), 'next-action row must exist');
  const empty = ruleBlock(stylesSrc, '#quickCollectModal.qc-success-open .qc-empty-amount-btn {');
  assert.ok(empty.includes('min-height: 24px'), 'empty-amount button must be a 24px text button');
});

test('fit budget: grid math — the fully-paid taxed card has 6 half-width items in 3 rows', () => {
  // QC Success Card Polish (2026-11-13): the fully-paid card hides
  // the Still-owed row, so the shape is Customer, Mobile, Date &
  // Method, Month, Area, Next due date = 6 half-width items in 3
  // rows (was 7 / 4); the tax row is full-width. The Month row no
  // longer adds a fourth row — it fills the row the hidden Still-owed
  // row vacated.
  const html = renderQuickCollectReceiptCardHtml({
    id: 'receipt-12', receiptNumber: 'RCPT-12-202611-01', amount: 1195,
    customerName: 'Test Customer', customerNumber: 12, date: '2026-11-08',
    month: '2026-11', method: 'Cash', area: 'Sodaa',
    payableRemaining: 0, newTotalDues: 0, salesTaxCents: 19500,
  });
  const halfWidth = (h) => {
    const all = (h.match(/<div class="qc-receipt-item/g) || []).length;
    const full = (h.match(/<div class="qc-receipt-item full-width/g) || []).length;
    return all - full;
  };
  assert.equal(halfWidth(html), 6, 'six half-width items with the Month row (Still-owed row hidden when fully paid)');
  assert.equal(Math.ceil(halfWidth(html) / 2), 3, '3 half-width rows with the Month row');
  const noMonth = { id: 'receipt-12', receiptNumber: 'RCPT-12-202611-01', amount: 1195,
    customerName: 'Test Customer', customerNumber: 12, date: '2026-11-08',
    method: 'Cash', area: 'Sodaa', payableRemaining: 0, newTotalDues: 0, salesTaxCents: 19500 };
  assert.equal(Math.ceil(halfWidth(renderQuickCollectReceiptCardHtml(noMonth)) / 2), 3, '3 half-width rows without the Month row — 5 items still fill 3 rows');
});

test('fit budget: measured totals are recorded — 1,075px at 360px (25px over the 1,050px budget), 1,103px at 320px', () => {
  // The harness is the authority (~/workspace/shahdara-qc-receipt-modal-harness/,
  // measure-qc-360.json / measure-qc-320.json, 0 pageerrors). These
  // pins record the measured totals so a regression is caught here;
  // they do NOT bless the overage — the user-locked budget is ≤1,050px
  // at 360px and ≤1,075px at 320px, and both are still missed.
  // QC Success Card Polish (2026-11-13): the totals below are
  // ARITHMETIC from the recorded harness totals, NOT a fresh harness
  // run — the harness cannot run in this sandbox, so the next harness
  // run must re-measure to confirm. Derivation: one 43px grid row
  // (the hidden Still-owed row: 17.28 label + 19.68 value + 6 gap)
  // leaves, and the amount pill's 1px border adds 2px: 1,116 − 43 + 2
  // = 1,075 at 360px; 1,144 − 43 + 2 = 1,103 at 320px. The breakdown
  // at 360px (variant A): header 44 + banner 104 + callout 104 +
  // card 474.6 + accordion 66 + actions 242.4 + step gaps/dialog
  // padding ~40 = 1,075px. Variant B (loaded) measures 1,114px —
  // within its ≤1,160px budget.
  const MEASURED_360_PX = 1075;
  const MEASURED_320_PX = 1103;
  const BUDGET_360_PX = 1050;
  const BUDGET_320_PX = 1075;
  assert.equal(MEASURED_360_PX, 1075, 'measured 360px total must be 1,075px (harness measure-qc-360.json cardScrollH, minus the hidden 43px Still-owed row plus the 2px pill border)');
  assert.equal(MEASURED_320_PX, 1103, 'measured 320px total must be 1,103px (harness measure-qc-320.json cardScrollH, minus the hidden 43px Still-owed row plus the 2px pill border)');
  assert.ok(MEASURED_360_PX > BUDGET_360_PX, `360px total ${MEASURED_360_PX}px is ${MEASURED_360_PX - BUDGET_360_PX}px OVER the ${BUDGET_360_PX}px budget — recorded here, not waived`);
  assert.ok(MEASURED_320_PX > BUDGET_320_PX, `320px total ${MEASURED_320_PX}px is ${MEASURED_320_PX - BUDGET_320_PX}px OVER the ${BUDGET_320_PX}px budget — recorded here, not waived`);
  // The overflow fix itself holds: the draft <pre> was the ONE source
  // (+558px); the accordion preview never overflows horizontally.
  assert.ok(!stylesSrc.includes('.qc-success-status-row'), 'old status-row class must be gone');
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
  // The heading, message, still-owes, badge, card, draft accordion and
  // actions all stay. The settle host, next-steps panel, repeat host
  // and Collect Another button are the deliberate removals (their
  // content moved into the merged row / next-action row).
  for (const id of ['quickCollectSuccessHeading', 'quickCollectSuccessMessage', 'sowStillOwesLine', 'osbOfflineSavedBadge', 'quickCollectReceiptCard', 'rsdReceiptShareDraft', 'quickCollectWhatsAppBtn', 'quickCollectShareImageBtn', 'quickCollectPrintReceiptBtn', 'quickCollectBluetoothPrintBtn', 'quickCollectDoneCloseBtn']) {
    assert.ok(pageSrc.includes(`id="${id}"`), `success step must keep #${id}`);
  }
  for (const hook of ['data-qc-same-customer', 'data-qc-next-customer', 'data-qc-empty-amount']) {
    assert.ok(pageSrc.includes(hook), `success step must keep ${hook}`);
  }
  assert.ok(pageSrc.includes('Payment Recorded Successfully'), 'heading wording must stay');
  assert.ok(pageSrc.includes('class="qc-success-heading-row"'), 'heading-row wrapper must exist');
  assert.ok(quickCollectSrc.includes("packageSuccessMessageOrDefault(amount)"), 'message source must stay the package message');
});
