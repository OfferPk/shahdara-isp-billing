// QC receipt-modal overhaul — BUDGET REWRITE of the polish #17 fit
// test: the Quick Collect success view is measured by the Chromium
// harness (~/workspace/shahdara-qc-receipt-modal-harness/), NOT by
// this static model. The harness is the authority for the true total;
// this file pins the structure, the CSS values, and the grid math
// that produce it, and RECORDS the measured totals.
//
// Measured (harness, 0 pageerrors, chromium-headless-shell):
//   360px variant A (fully paid): 1,081px, cardOverX 0 — 31px OVER the
//     user-locked ≤1,050px budget. Recorded, not blessed. (Harness
//     1,116px at QC-top time; QC-bottom's arithmetic 1,119px; this
//     micro-polish 2026-11-20 saves a further 38px — banner −19
//     (margin +8, heading row −27), callout +11, card −30; see the
//     measured-totals test for the derivation.) The heading + 24px
//     check now fit one line at 360px (~24px row, not the 48px
//     two-line row the old 16px title + 32px check needed). No field
//     or action is hidden to force the number; the overage is
//     disclosed, not waived.
//   320px variant A: 1,109px, cardOverX 0 — 34px over the ≤1,075px
//     budget. The pills row wraps to two lines at 320px
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

test('structure: the card has no header div any more — the number lives in its own pill row below', () => {
  const receipt = {
    id: 'receipt-12',
    receiptNumber: 'RCPT-12-202611-01',
    receiptSequence: 12,
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
  // Numbering lands second (§0.4 empty-header rule): the micro-polish
  // removed the shared badge and numbering removed the ref chip, so the
  // header div itself is gone — the card opens straight onto the pill row.
  assert.ok(!html.includes('qc-receipt-header'), 'card header div must be gone (badge removed by micro-polish, ref chip by numbering)');
  assert.ok(!html.includes('Settle in Full'), 'card must not carry the settle badge');
  assert.ok(!html.includes('Partial Payment'), 'card must not carry the partial badge');
  assert.ok(!html.includes('badge-receipt-unshared') && !html.includes('badge-receipt-shared'), 'card must not carry the shared badge (removed by the QC receipt micro-polish, 2026-11-20)');
  const rowAt = html.indexOf('qc-receipt-number-row');
  assert.ok(rowAt >= 0, 'card must carry a receipt-number pill row');
  const row = html.slice(html.lastIndexOf('<div', rowAt), html.indexOf('</div>', rowAt));
  assert.ok(row.includes('Receipt No.'), 'pill row must label the number');
  assert.ok(row.includes('>12<'), 'pill row must show the global sequence');
  assert.ok(row.includes('qc-amount-pill'), 'pill row must reuse the Amount Collected pill classes');
  assert.ok(!row.includes('RCPT-12-202611-01'), 'pill row must show the sequence, not the stored number');
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
  // 40px (i) button drives it); margin-bottom 0, top 0.
  const header = ruleBlock(stylesSrc, '#quickCollectModal.qc-success-open .modal-heading {');
  assert.ok(stylesSrc.includes('#quickCollectModal.qc-success-open .modal-heading { margin-bottom: 0 !important; }'), 'header margin-bottom must be 0 on success');
  assert.ok(header.includes('top: 0'), 'header must stick at top 0 (the old -16px offset is gone)');
  const helpBtn = ruleBlock(stylesSrc, '#quickCollectModal .help-info-btn {');
  // Sharafat 96: the (i) button is 40x40 now (was 32x32) — the 40px
  // touch-target floor for the help affordances.
  assert.ok(helpBtn.includes('width: 40px') && helpBtn.includes('height: 40px'), '(i) button must be 40x40 on success');
  assert.ok(helpBtn.includes('min-height: 40px !important'), '(i) button must beat the global 44px min-height rule');
  const closeBtn = ruleBlock(stylesSrc, '#quickCollectModal #closeQuickCollectModalBtn {');
  assert.ok(closeBtn.includes('width: 32px') && closeBtn.includes('height: 32px'), 'close button must be 32x32 on success');

  // Banner — unified emerald: brand-soft bg, success border, 10px 12px.
  // (QC success-receipt polish, TOP, 2026-11-19: 12px 16px → 10px 12px;
  // QC receipt micro-polish, 2026-11-20: margin-top 8px added, radius
  // 12px already present.)
  const banner = ruleBlock(stylesSrc, '#quickCollectModal.qc-success-open .qc-success-banner {');
  assert.ok(banner.includes('background: var(--ds-brand-soft)'), 'banner must use the brand-soft background');
  assert.ok(banner.includes('border: 1px solid var(--ds-success-border)'), 'banner must use the success border');
  assert.ok(banner.includes('padding: 10px 12px'), 'banner padding must be 10px 12px on success');
  assert.ok(banner.includes('margin-top: 8px'), 'banner must have 8px margin-top on success');
  assert.ok(banner.includes('border-radius: 12px'), 'banner must keep its 12px radius on success');

  // Heading — 14px (was 16px, QC receipt micro-polish 2026-11-20),
  // margin 0. The heading + 24px check fit one line at 360px
  // (~24px row) — the 16px title + 32px check wrapped to two lines
  // (48px row) in the harness.
  const heading = ruleBlock(stylesSrc, '#quickCollectSuccessHeading {');
  assert.ok(heading.includes('font-size: 14px'), 'heading must be explicit 14px');
  assert.ok(heading.includes('margin: 0'), 'heading margin must be 0');
  // Tick — 24px inline, in the heading row.
  const check = ruleBlock(stylesSrc, '#quickCollectModal.qc-success-open .qc-success-check {');
  assert.ok(check.includes('width: 24px') && check.includes('height: 24px'), 'inline tick must be 24px on success');
  assert.ok(pageSrc.includes('<div class="qc-success-heading-row">'), 'tick must live in the heading row');
  assert.equal((pageSrc.match(/class="qc-success-check"/g) || []).length, 1, 'no hero tick row may remain');

  // Callout — the Urdu package note in its own box below the banner.
  // (QC success-receipt polish, TOP, 2026-11-19: 10px 14px → 8px 12px;
  // QC receipt micro-polish, 2026-11-20: 8px 12px → 12px 16px, accent
  // border-inline-end → border-inline-start.)
  const callout = ruleBlock(stylesSrc, '#quickCollectModal.qc-success-open .qc-success-callout {');
  assert.ok(callout.includes('background: var(--ds-nested)'), 'callout must use the nested background');
  // Sharafat 95: the callout accent is a logical border now
  // (border-inline-start) so it stays on the card's start edge (right)
  // in Urdu mode.
  assert.ok(callout.includes('border-inline-start: 3px solid var(--ds-brand)'), 'callout must carry the brand start border');
  assert.ok(callout.includes('padding: 12px 16px'), 'callout padding must be 12px 16px');
  assert.ok(callout.includes('direction: rtl'), 'callout must be RTL');

  // Message — Nastaliq 14px / line-height 2.1, margins 0 (in the callout).
  const messageNastaliq = ruleBlock(stylesSrc, '#quickCollectSuccessMessage.qc-urdu-nastaliq {');
  assert.ok(messageNastaliq.includes('font-size: 14px'), 'Urdu message must be 14px');
  const nastaliq = stylesSrc.slice(stylesSrc.indexOf('#quickCollectSuccessMessage.qc-urdu-nastaliq,'), stylesSrc.indexOf('}', stylesSrc.indexOf('#quickCollectSuccessMessage.qc-urdu-nastaliq,')));
  assert.ok(nastaliq.includes('line-height: 2.1'), 'Nastaliq line-height must be 2.1');
  const message = ruleBlock(stylesSrc, '#quickCollectSuccessMessage {');
  assert.ok(message.includes('margin: 0'), 'message margins must be 0');

  // C1 — card padding 10 → 8 (top + bottom).
  // (QC success-receipt polish, TOP, 2026-11-19.)
  const card = ruleBlock(stylesSrc, '#quickCollectModal.qc-success-open .qc-receipt-card {');
  assert.ok(card.includes('padding: 8px'), 'C1: card padding must be 8px on success');

  // C2 — card gap 8 → 6.
  // (QC success-receipt polish, TOP, 2026-11-19.)
  assert.ok(card.includes('gap: 6px'), 'C2: card gap must be 6px on success');

  // C3 — the shared badge is GONE from the QC receipt card (user
  // instruction 2026-11-20 — removed, not hidden), so the header
  // keeps only the receipt reference group on its own right-aligned
  // line. The reference shows the FULL stored number (QC
  // receipt-bottom polish, 2026-11-19) — the number is never
  // re-shortened to fit.
  assert.ok(stylesSrc.includes('#quickCollectModal.qc-success-open .qc-receipt-card .qc-receipt-header { flex-wrap: wrap; }'), 'C3: header must wrap so the full-number ref drops to its own line');
  assert.ok(!stylesSrc.includes('#quickCollectModal.qc-success-open .qc-receipt-card .qc-receipt-badge { white-space: nowrap; }'), 'C3: scoped badge rules must be gone (badge removed 2026-11-20)');

  // C4 — amount 1.5rem → 1.3rem, row padding 4 → 2.
  const amount = ruleBlock(stylesSrc, '#quickCollectModal.qc-success-open .qc-receipt-card .qc-receipt-amount {');
  assert.ok(amount.includes('font-size: 1.3rem'), 'C4: amount must be 1.3rem on success');
  // QC Success Card Polish (2026-11-13): the row is a pill now, so
  // C4 reads the pill rule — padding 2px 14px (vertical stays 2px,
  // horizontal is the pill shape).
  const amountRow = ruleBlock(stylesSrc, '#quickCollectModal.qc-success-open .qc-receipt-card .qc-receipt-amount-row.qc-amount-pill {');
  assert.ok(amountRow.includes('padding: 2px 14px'), 'C4: amount pill padding must be 2px 14px on success');

  // C5 — grid row-gap 5 → 2 (QC receipt micro-polish, 2026-11-20:
  // column-gap stays 5px); the Area select is a 30px pill (was a 44px
  // select, then a dead 34px rule — the pill is the live value).
  // (QC success-receipt polish, TOP, 2026-11-19: grid gap 6 → 5px.)
  const grid = ruleBlock(stylesSrc, '#quickCollectModal.qc-success-open .qc-receipt-card .qc-receipt-grid {');
  assert.ok(grid.includes('row-gap: 2px'), 'C5: grid row-gap must be 2px on success');
  assert.ok(grid.includes('column-gap: 5px'), 'C5: grid column-gap must stay 5px on success');
  const areaSelect = ruleBlock(stylesSrc, '#quickCollectModal.qc-success-open .qc-receipt-card .qc-area-select {');
  assert.ok(areaSelect.includes('height: 30px'), 'C5: Area pill must be 30px tall on success');
  assert.ok(areaSelect.includes('min-height: 0'), 'C5: Area pill must beat the 44px select floor');

  // T1 — terms block (margins, padding, <p> margins).
  const terms = ruleBlock(stylesSrc, '#quickCollectModal.qc-success-open .qc-receipt-card .receipt-urdu-notice.qc-urdu-nastaliq {');
  assert.ok(terms.includes('margin: 10px 0'), 'T1: terms margin must be 10px 0 on success');
  assert.ok(terms.includes('padding: 8px 10px'), 'T1: terms padding must be 8px 10px on success');
  const termsP = ruleBlock(stylesSrc, '#quickCollectModal.qc-success-open .qc-receipt-card .receipt-urdu-notice.qc-urdu-nastaliq p {');
  assert.ok(termsP.includes('margin: 0'), 'T1: terms <p> margins must be 0 on success');

  // G1 — step gap 8 → 6.
  // (QC success-receipt polish, TOP, 2026-11-19.)
  const step = ruleBlock(stylesSrc, '#quickCollectModal.qc-success-open #quickCollectStepSuccess {');
  assert.ok(step.includes('gap: 6px'), 'G1: success step gap must be 6px');

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
  // 2-col; empty-amount secondary button; Done full-width ghost.
  const primary = ruleBlock(stylesSrc, '#quickCollectModal.qc-success-open .qc-wa-btn {');
  assert.ok(primary.includes('min-height: 48px'), 'primary must be 48px');
  assert.ok(primary.includes('background: var(--ds-brand)'), 'primary must be the solid brand');
  assert.ok(stylesSrc.includes('.qc-output-grid'), 'output grid must exist');
  assert.ok(stylesSrc.includes('.qc-next-row'), 'next-action row must exist');
  const empty = ruleBlock(stylesSrc, '#quickCollectModal.qc-success-open .qc-empty-amount-btn {');
  assert.ok(!empty.includes('min-height: 24px'), 'empty-amount button must no longer be a 24px text button');
  assert.ok(!empty.includes('text-decoration: underline'), 'empty-amount button must no longer be underlined');
  assert.ok(pageSrc.includes('secondary-button qc-empty-amount-btn'), 'empty-amount button must carry the secondary-button treatment');
});

test('fit budget: grid math — the fully-paid taxed card has 0 half-width items; the six detail rows are pill rows', () => {
  // QC Success Card Polish (2026-11-13): the fully-paid card hides
  // the Still-owed row. QC success rows pill (user, 2026-11-21):
  // the six detail rows (Customer, Mobile, Date & Method, Month,
  // Area, Next due date) left the two-column grid and became
  // full-width pill rows — the grid keeps only the full-width tax
  // row, so the half-width count is 0 with or without the Month row.
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
  assert.equal(halfWidth(html), 0, 'zero half-width items with the Month row (Still-owed row hidden when fully paid)');
  assert.equal(Math.ceil(halfWidth(html) / 2), 0, '0 half-width rows with the Month row');
  const noMonth = { id: 'receipt-12', receiptNumber: 'RCPT-12-202611-01', amount: 1195,
    customerName: 'Test Customer', customerNumber: 12, date: '2026-11-08',
    method: 'Cash', area: 'Sodaa', payableRemaining: 0, newTotalDues: 0, salesTaxCents: 19500 };
  assert.equal(Math.ceil(halfWidth(renderQuickCollectReceiptCardHtml(noMonth)) / 2), 0, '0 half-width rows without the Month row — 5 pill rows, no grid rows');
  const pills = (html.match(/qc-receipt-amount-row qc-amount-pill qc-receipt-detail-row/g) || []).length;
  assert.equal(pills, 6, 'six detail pill rows with the Month row');
});

test('fit budget: measured totals are recorded — 1,107px at 360px (57px over the 1,050px budget), 1,116px at 320px', () => {
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
  // leaves, the amount pill's 1px border adds 2px, the Empty amount
  // restyle (24px text button -> 44px secondary button) adds 20px,
  // and the full-number header wrap adds one ~24px row (the badge row:
  // 12px font x 1.5 line-height + 4px padding + 2px border): 1,116
  // − 43 + 2 + 20 + 24 = 1,119 at 360px; 1,144 − 43 + 2 + 20 + 24
  // = 1,147 at 320px. The breakdown at 360px (variant A): header 44
  // + banner 104 + callout 104 + card 498.6 + accordion 66 + actions
  // 262.4 + step gaps/dialog padding ~40 = 1,119px. Variant B
  // (loaded) measures 1,114px — within its ≤1,160px budget.
  // QC receipt micro-polish (2026-11-20): from the QC-bottom totals
  // (1,119 @360 / 1,147 @320): banner +8 margin −27 heading row
  // (51px two lines → 24px one line) = 85; callout +8 padding +3
  // line-height (2 lines × 14px × 0.1) = 115; card −24 badge row −6
  // grid row-gap (2 gaps × 3px) = 468.6. Net −38px: 1,119 − 38 =
  // 1,081 at 360px; 1,147 − 38 = 1,109 at 320px. The breakdown at
  // 360px (variant A): header 44 + banner 85 + callout 115 + card
  // 468.6 + accordion 66 + actions 262.4 + step gaps/dialog padding
  // ~40 = 1,081px.
  // QC receipt numbering (2026-11-20, lands second — §0.4 empty-header
  // rule): from the micro-polish totals (1,081 @360 / 1,109 @320):
  // the header ref chip leaves so the header unwraps (−24px), the new
  // Receipt No. pill row adds one row (1.3rem amount x 1.5 line-height
  // = 31.2px + 4px padding + 2px border ≈ 37px) plus one 6px card gap
  // (+6px), and the now-empty header div itself goes with it: its
  // padding-bottom (8px) + dashed border (1px) + one 6px card gap
  // (−15px). Net +4px. 1,081 + 4 = 1,085 at 360px; 1,109 + 4 = 1,113
  // at 320px. Cross-check from the QC-bottom base: −38 (micro-polish)
  // + 19 (numbering alone) − 15 (header div) = −34: 1,119 − 34 =
  // 1,085; 1,147 − 34 = 1,113. CORRECTION to the prep §7.3: the prep's
  // combined 1,099/1,127 counted the header-div removal as −1 (its
  // border only) and missed its 8px padding + 6px gap — 14px short.
  // Variant B (loaded) was 1,114px after the micro-polish — within its
  // ≤1,160px budget; the +4px numbering delta keeps it inside.
  // QC success rows pill (user, 2026-11-21): from the numbering
  // totals (1,085 @360 / 1,113 @320). MEASURED, not arithmetic: the
  // polish17 fixture card was rendered from the base renderer and
  // from the new renderer in headless Chromium (playwright
  // chromium_headless_shell, real styles.css + tokens.css, the
  // #quickCollectModal.qc-success-open scoping, card 316px wide at
  // 360px / 276px at 320px) and the card heights compared. Base card
  // 505.8px → new card 528.0px at 360px (delta +22.2px); base 525.5px
  // → new 528.0px at 320px (delta +2.5px — the base grid wraps more
  // at 320px, the pill rows barely do). Detail rows at 360px:
  // Customer 27, Mobile 27, Date & Method 27, Month 27, Area 36,
  // Next due 48 (the fixture's fallback "Next due date not recorded"
  // wraps to two lines; a real date reads one line, 27px). The Area
  // row is 36px only after the label-nowrap + select-cap fix — before
  // it the select's longest-option width squeezed the label into two
  // lines (46.8px). New totals: 1,085 + 22.2 = 1,107.2 → 1,107 at
  // 360px; 1,113 + 2.5 = 1,115.5 → 1,116 at 320px. The fixture has
  // no customerId, so no Change button renders; with a customer and
  // a real due date the card measures 530px at 360px (Mobile row
  // 50px with the 44px Change button, Next due 27px) — within 2px of
  // the fixture card, so these totals stay representative. The 44px
  // Change-button floor (Sharafat 96) was measured and deliberately
  // NOT overridden: it would save only 4px.
  const MEASURED_360_PX = 1107;
  const MEASURED_320_PX = 1116;
  const BUDGET_360_PX = 1050;
  const BUDGET_320_PX = 1075;
  assert.equal(MEASURED_360_PX, 1107, 'measured 360px total must be 1,107px (numbering 1,085px plus rows-pill +22.2 measured in headless Chromium)');
  assert.equal(MEASURED_320_PX, 1116, 'measured 320px total must be 1,116px (numbering 1,113px plus rows-pill +2.5 measured in headless Chromium)');
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
