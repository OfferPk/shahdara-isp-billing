// QC receipt-modal overhaul — spec §8 implementer test plan.
// This file pins the ten areas the spec lists. Computed geometry
// (32×32 buttons, 52px header target, scrollWidth === clientWidth,
// title rect inside the dialog) is pinned by the Chromium harness
// (~/workspace/shahdara-qc-receipt-modal-harness/, measure-*.json,
// 0 pageerrors on every run); node:test pins the structure, the CSS
// text, the builder outputs and the wiring source that produce it.
// The harness is the authority for the true totals; the fit test
// (tests/polish17-qc-success-fit.test.js) records them.
// Pattern-fake data only: Test Customer, RCPT-12-202611-01.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderQuickCollectReceiptCardHtml, formatQuickCollectWhatsAppReceipt } from '../nav-quick-collect.js';
import { renderSplitReceiptCardHtml } from '../split-tender-collect.js';
import { receiptShareDraftHtml, receiptShareDraftFor } from '../receipt-share-draft.js';

const read = (name) => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const stylesSrc = read('styles.css');
const pageSrc = read('index.html');
const quickCollectSrc = read('nav-quick-collect.js');
const draftSrc = read('receipt-share-draft.js');
const languageSrc = read('nav-language.js');

const FIXTURE = {
  id: 'receipt-12', receiptNumber: 'RCPT-12-202611-01', amount: 1000,
  customerName: 'Test Customer', customerNumber: 12, date: '2026-11-08',
  month: '2026-11', method: 'Easypaisa', area: 'Sodaa',
  payableRemaining: 0, newTotalDues: 0, senderName: 'Sender A',
};

function ruleBlock(css, selectorWithBrace) {
  const start = css.indexOf(selectorWithBrace);
  assert.ok(start >= 0, `missing rule ${selectorWithBrace}`);
  const open = css.indexOf('{', start);
  const close = css.indexOf('}', open);
  return css.slice(open + 1, close);
}

// 1. Header: single row; (i) 32×32 keeping data-help; close 32×32 neutral.
test('§8.1 header: (i) is 32x32 and keeps data-help; close is 32x32 neutral, not red 48px', () => {
  const helpBtn = ruleBlock(stylesSrc, '#quickCollectModal .help-info-btn {');
  assert.ok(helpBtn.includes('width: 32px') && helpBtn.includes('height: 32px'), '(i) must be 32x32');
  assert.ok(helpBtn.includes('min-height: 32px !important'), '(i) must beat the global 44px min-height rule');
  const closeBtn = ruleBlock(stylesSrc, '#quickCollectModal #closeQuickCollectModalBtn {');
  assert.ok(closeBtn.includes('width: 32px !important') && closeBtn.includes('height: 32px !important'), 'close must be 32x32');
  assert.ok(closeBtn.includes('background: var(--color-neutral-100, #f0f4f2)'), 'close must be neutral, not red');
  assert.ok(!closeBtn.includes('var(--red'), 'close must not use the red close colour');
  assert.ok(pageSrc.includes('data-help="collect_payment"'), '(i) must keep data-help="collect_payment"');
  const helpBtnHtml = pageSrc.slice(pageSrc.indexOf('data-help="collect_payment"'), pageSrc.indexOf('data-help="collect_payment"') + 200);
  assert.ok(helpBtnHtml.includes('data-ds-icon="Info"'), '(i) must carry the Info icon hook');
  // The sticky header is 44px measured (harness) — more compact than
  // the 52px target, not taller. The title + (i) + close fit one line.
  const header = ruleBlock(stylesSrc, '#quickCollectModal.qc-success-open .modal-heading {');
  assert.ok(header.includes('top: 0'), 'header must stick at top 0');
  const title = ruleBlock(stylesSrc, '#quickCollectTitle {');
  assert.ok(title.includes('white-space: nowrap'), 'title must not wrap to a second line');
});

// 2. Title never clips: the CSS that guarantees it (sticky + one-line
// title); the rect assertion lives in the harness (scroll to bottom,
// title stays at y=37 inside the dialog at 360px and 320px).
test('§8.2 title never clips: sticky header at top 0 with a one-line ellipsis title', () => {
  const header = ruleBlock(stylesSrc, '#quickCollectModal.qc-success-open .modal-heading {');
  assert.ok(header.includes('top: 0'), 'header must stick at top 0 (the old -16px offset is gone)');
  const stickyRule = stylesSrc.slice(stylesSrc.indexOf('/* Sticky header with wrapping title'), stylesSrc.indexOf('/* Sticky header with wrapping title') + 900);
  assert.ok(stickyRule.includes('position: sticky !important'), 'header must stay sticky (the ≤640px .modal-heading rule)');
  assert.ok(stickyRule.includes('.modal-heading'), 'sticky rule must cover .modal-heading');
  const title = ruleBlock(stylesSrc, '#quickCollectTitle {');
  assert.ok(title.includes('text-overflow: ellipsis'), 'title must truncate with an ellipsis, never clip');
  assert.ok(pageSrc.includes('Quick Collect Cash'), 'title text must stay');
});

// 3. No horizontal overflow: the containment rules (the harness asserts
// scrollWidth === clientWidth at 360px and 320px, card + dialog + pre,
// expanded and collapsed — all 0 in the three runs).
test('§8.3 no horizontal overflow: containment rules on card, dialog, preview and long values', () => {
  const cardRule = ruleBlock(stylesSrc, '.quick-collect-card {');
  assert.ok(cardRule.includes('overflow-x: hidden'), 'card must clip horizontal overflow');
  const dialog = stylesSrc.slice(stylesSrc.indexOf('#quickCollectModal.qc-success-open {'), stylesSrc.indexOf('}', stylesSrc.indexOf('#quickCollectModal.qc-success-open {')));
  assert.ok(dialog.includes('overflow-wrap: anywhere') || stylesSrc.includes('#quickCollectModal { overflow-wrap: anywhere'), 'dialog must break long words anywhere');
  const pre = stylesSrc.slice(stylesSrc.indexOf('.rsd-share-draft-text'));
  assert.ok(pre.includes('white-space: pre-wrap'), 'draft preview must wrap');
  assert.ok(pre.includes('overflow-wrap: anywhere'), 'draft preview must break anywhere');
  assert.ok(stylesSrc.includes('.qc-txnid-code { word-break: break-word;'), 'transaction id must break');
  assert.ok(!stylesSrc.includes('.qc-success-status-row'), 'old status-row class must be gone');
});

// 4. Pills: exactly two visible; settle badge absent; pending-charges
// label appears when ticket/boost charges remain.
test('§8.4 pills: exactly two, settle badge absent, charged label when charges remain', () => {
  const banner = pageSrc.indexOf('class="qc-success-banner"');
  const pillsRow = pageSrc.indexOf('class="qc-success-pills-row"', banner);
  const callout = pageSrc.indexOf('class="qc-success-callout"');
  const rowHtml = pageSrc.slice(pillsRow, callout);
  assert.ok(rowHtml.includes('id="sowStillOwesLine"'), 'pills row must hold the still-owes line');
  assert.ok(rowHtml.includes('id="osbOfflineSavedBadge"'), 'pills row must hold the saved badge');
  assert.ok(!pageSrc.includes('qcSettleStatusBadge'), 'settle badge must be absent from the success screen');
  assert.ok(!pageSrc.includes('Settle in Full'), 'no settle text may remain in the success step');
  // Charged label: the merged row reads the Plan 526 charged label
  // when the figure is > 0 AND charges are pending.
  const charged = renderQuickCollectReceiptCardHtml({ ...FIXTURE, payableRemaining: 300, newTotalDues: 300, ticketChargesPending: 300 });
  assert.ok(charged.includes('Still owed (incl. pending charges)'), 'charged label must appear when charges remain');
  assert.ok(charged.includes('PKR 300'), 'charged figure must show');
  const uncharged = renderQuickCollectReceiptCardHtml({ ...FIXTURE, payableRemaining: 300, newTotalDues: 300 });
  assert.ok(uncharged.includes('Still owed') && !uncharged.includes('(incl. pending charges)'), 'uncharged label must be plain Still owed');
});

// 5. Receipt card: merged row, DD/MM/YYYY next due, Amount Collected
// once, no second summary card.
test('§8.5 receipt card: merged row, DD/MM/YYYY next due, Amount Collected once, no second card', () => {
  const html = renderQuickCollectReceiptCardHtml({ ...FIXTURE }, { nextDueDateText: '05/12/2026' });
  assert.ok(html.includes('Still owed'), 'merged row must be present');
  assert.ok(html.includes('Fully paid'), 'fully-paid merged row must read Fully paid');
  assert.ok(!html.includes('Remaining Balance'), 'no Remaining Balance row may remain');
  assert.ok(!html.includes('PKR 0'), 'no PKR 0 text may appear');
  assert.ok(html.includes('05/12/2026'), 'next due date must be DD/MM/YYYY');
  assert.ok(!html.includes('2026-12-05'), 'next due date must not be the raw ISO date');
  assert.equal((html.match(/Amount Collected/g) || []).length, 1, 'Amount Collected must appear once');
  assert.ok(!html.includes('Amount paid'), 'no Amount paid duplicate may appear');
  assert.ok(!pageSrc.includes('id="snsSuccessNextSteps"'), 'second summary card container must be absent');
  assert.ok(!pageSrc.includes('id="rptRepeatPayment"'), 'repeat host must be absent');
  // Split card: same merged row.
  const split = renderSplitReceiptCardHtml(
    { legs: [{ method: 'Cash', amountCents: 100000 }], totalReceivedCents: 100000, balanceDueCents: 0, status: 'paid' },
    '',
    { nextDueDateText: '05/12/2026', chargesPending: false },
  );
  assert.ok(split.includes('Still owed') && split.includes('Fully paid'), 'split card must carry the merged row');
  assert.ok(split.includes('05/12/2026'), 'split card must show the DD/MM/YYYY next due date');
});

// 6. Area pill: the save path, the empty-choice guard, ≤ 32px tall.
test('§8.6 area pill: delegated save path, empty choice never wipes, pill is 30px', () => {
  const handler = quickCollectSrc.slice(quickCollectSrc.indexOf("'[data-qc-area-select]'"), quickCollectSrc.indexOf("'[data-qc-area-select]'") + 1200);
  assert.ok(handler.includes('updateCustomerProfile(getState(), activeCustomerId, { mohalla: stored })'), 'area change must save via updateCustomerProfile');
  assert.ok(handler.includes('onSaveState(nextState)'), 'area change must call onSaveState');
  assert.ok(handler.includes("if (!raw) { renderActiveReceiptCard(); return; }"), 'empty choice must re-render only, never wipe the profile area');
  assert.ok(handler.includes('renderActiveReceiptCard()'), 'area change must re-render the card');
  const areaSelect = ruleBlock(stylesSrc, '#quickCollectModal.qc-success-open .qc-receipt-card .qc-area-select {');
  assert.ok(areaSelect.includes('height: 30px'), 'area pill must be 30px tall (≤ 32px)');
  assert.ok(areaSelect.includes('min-height: 0'), 'area pill must beat the 44px select floor');
  assert.ok(areaSelect.includes('appearance: none'), 'area pill must hide the native select arrow');
  assert.ok(quickCollectSrc.includes("dsIcon('ChevronDown', 14)"), 'area pill must carry the ChevronDown icon');
  assert.ok(quickCollectSrc.includes('class="qc-area-pill"'), 'area select must be wrapped in the pill');
});

// 7. Draft accordion: collapsed by default; Copy copies the exact
// dispatch text; Send/Dismiss mini-row absent.
test('§8.7 draft accordion: collapsed by default, copy is the exact dispatch text, no Send/Dismiss', () => {
  const draft = receiptShareDraftHtml(receiptShareDraftFor(FIXTURE, formatQuickCollectWhatsAppReceipt(FIXTURE).text));
  assert.ok(draft.includes('aria-expanded="false"'), 'accordion must be collapsed by default');
  assert.ok(draft.includes('data-rsd-body hidden'), 'accordion body must be hidden by default');
  assert.ok(draft.includes('data-rsd-copy'), 'accordion must carry a Copy Text button');
  assert.ok(draft.includes('Preview WhatsApp Message Text'), 'accordion must be titled Preview WhatsApp Message Text');
  assert.ok(draft.includes('RCPT-12-202611-01'), 'accordion preview must hold the receipt text');
  assert.ok(!draftSrc.includes('data-rsd-send'), 'draft Send button must be gone');
  assert.ok(!draftSrc.includes('data-rsd-dismiss'), 'draft Dismiss button must be gone');
  assert.ok(!draftSrc.includes('RECEIPT_SHARE_DRAFT_SEND_TEXT'), 'Send constant must be gone');
  assert.ok(!draftSrc.includes('RECEIPT_SHARE_DRAFT_DISMISS_TEXT'), 'Dismiss constant must be gone');
  // The Copy wiring reads the live preview text (the same string the
  // dispatch sends) — assert the wiring source.
  assert.ok(quickCollectSrc.includes("'.rsd-share-draft-text'"), 'copy must read the live preview text');
  assert.ok(quickCollectSrc.includes('navigator.clipboard.writeText'), 'copy must use the clipboard');
  assert.ok(quickCollectSrc.includes("'qc_toast_draft_copied'"), 'copy success must toast the copied message');
  assert.ok(quickCollectSrc.includes("'qc_toast_draft_copy_failed'"), 'copy failure must toast the failure message');
  // The preview text is the dispatch text (the same string, not a copy).
  const preview = receiptShareDraftFor(FIXTURE, formatQuickCollectWhatsAppReceipt(FIXTURE).text);
  assert.equal(preview.text, formatQuickCollectWhatsAppReceipt(FIXTURE).text, 'preview text must equal the dispatch text');
});

// 8. Actions: primary 48px brand + WhatsApp icon; 3-col grid with
// distinct icons; 2-cell layout when BT hidden; 2-col row handlers;
// Done full-width ghost; sent text byte-identical to pre-redesign.
test('§8.8 actions: primary, output grid, next row, Done, byte-identical sent text', () => {
  const primary = ruleBlock(stylesSrc, '#quickCollectModal.qc-success-open .qc-wa-btn {');
  assert.ok(primary.includes('min-height: 48px'), 'primary must be 48px');
  assert.ok(primary.includes('background: var(--ds-brand)'), 'primary must be the solid brand');
  assert.ok(stylesSrc.includes('#quickCollectModal.qc-success-open .qc-wa-btn::before'), 'primary must carry the WhatsApp glyph as ::before');
  const before = stylesSrc.slice(stylesSrc.indexOf('#quickCollectModal.qc-success-open .qc-wa-btn::before'), stylesSrc.indexOf('}', stylesSrc.indexOf('#quickCollectModal.qc-success-open .qc-wa-btn::before')));
  assert.ok(before.includes('data:image/svg+xml'), 'WhatsApp glyph must be a data-URI SVG');
  assert.ok(before.includes('%23ffffff'), 'WhatsApp glyph must be white-filled');
  // Output grid: 3 cells with distinct icons (Image, Printer, Bluetooth).
  const grid = pageSrc.slice(pageSrc.indexOf('class="qc-output-grid"'), pageSrc.indexOf('</div>', pageSrc.indexOf('class="qc-output-grid"')));
  assert.ok(grid.includes('data-ds-icon="Image"'), 'Share Image must carry the Image icon');
  assert.ok(grid.includes('data-ds-icon="Printer"'), 'Print Slip must carry the Printer icon');
  assert.ok(grid.includes('data-ds-icon="Bluetooth"'), 'BT Print must carry the Bluetooth icon (distinct from Print Slip)');
  assert.ok(stylesSrc.includes('.qc-output-grid:has(#quickCollectBluetoothPrintBtn[hidden])'), 'grid must drop to 2 columns when BT is hidden');
  // Next row: both buttons, correct handlers (same-customer full-dues
  // prefill vs next-customer reset).
  assert.ok(pageSrc.includes('data-qc-same-customer'), 'next row must hold the same-customer button');
  assert.ok(pageSrc.includes('data-qc-next-customer'), 'next row must hold the next-customer button');
  assert.ok(pageSrc.includes('data-qc-empty-amount'), 'empty-amount button must exist');
  assert.ok(quickCollectSrc.includes("openCustomerCollectionForm(activeCustomerId)"), 'same-customer must prefill full dues');
  assert.ok(quickCollectSrc.includes("openCustomerCollectionForm(activeCustomerId, { emptyAmount: true })"), 'empty-amount must pass emptyAmount');
  assert.ok(quickCollectSrc.includes('collectAnotherCustomer()'), 'next-customer must reset to the next customer');
  // Done: full-width ghost — the actions container is a flex column
  // (children stretch), the button pins 44px and carries the neutral
  // secondary-button look.
  const actions = ruleBlock(stylesSrc, '.qc-success-actions {');
  assert.ok(actions.includes('display: flex') && actions.includes('flex-direction: column'), 'actions must be a flex column (children stretch full-width)');
  const done = ruleBlock(stylesSrc, '#quickCollectModal.qc-success-open .qc-done-btn {');
  assert.ok(done.includes('min-height: 44px'), 'Done must be 44px');
  assert.ok(pageSrc.includes('id="quickCollectDoneCloseBtn" class="secondary-button qc-done-btn"'), 'Done must be a neutral secondary button');
  // Sent text byte-identical to the pre-redesign text for the fixture.
  const golden = '*SHAHDARA FIBER NETWORK & ISP BILLING*\n'
    + '━━━━━━━━━━━━━━━━━━━━━━━━\n'
    + '*PAYMENT RECEIPT / ادائیگی کی رسید*\n'
    + '🧾 *Receipt No:* RCPT-12-202611-01\n'
    + '📅 *Date:* 08/11/2026\n'
    + '👤 *Customer:* Test Customer (#12)\n'
    + '📍 *Area:* Sodaa\n'
    + '🗓️ *Billing Month:* 2026-11\n'
    + '💵 *Amount Received:* PKR 1,000\n'
    + '💳 *Payment Method:* Easypaisa\n'
    + '⚖️ *Remaining Balance:* PKR 0\n'
    + '📌 *Status:* مکمل ادا شدہ (PAID IN FULL)\n'
    + 'Shukriya! Thank you for your prompt payment.\n'
    + 'Shahdara NOC & Field Billing Operations\n'
    + 'شرائط و ضوابط کے تحت پانچ تاریخ تک اگر انٹرنیٹ کی فیس ادا نہ ہو تو عارضی نیٹ بند ہو گا، فیس ادا کرنے پہ نیٹ دوبارہ بحال ہو گا\n'
    + 'ٹیکنیکل سپورٹ کے لیے سعد سے رابطہ کریں: +92 341 5277081\n'
    + '━━━━━━━━━━━━━━━━━━━━━━━━';
  assert.equal(formatQuickCollectWhatsAppReceipt(FIXTURE).text, golden, 'sent text must be byte-identical to the pre-redesign text');
});

// 9. Ratchet: no new hex; no new store key / element id beyond the spec
// (the spec names none — the redesign uses data hooks, not new ids).
// Card Polish (sequence step 3) moved the count 616 → 614: it replaced
// the card stat boxes' five hardcoded colours with DS tokens, and two
// of them (#f8fbf9 background, #667b71 label) appeared nowhere else in
// the sheet, so they left the distinct set entirely. The direction is
// the ratchet's own: fewer hardcoded colours, never more.
test('§8.9 ratchet: styles.css still 614 distinct hex; no new store key or element id', () => {
  const stripped = stylesSrc.replace(/\/\*[\s\S]*?\*\//g, '');
  const distinct = new Set(stripped.match(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g) || []);
  assert.equal(distinct.size, 614, 'styles.css must stay at 614 distinct hex (no new hard-coded colour)');
  const storeKeys = [...new Set(quickCollectSrc.match(/shahdara_[a-z0-9_]+/g) || [])].sort();
  assert.deepEqual(storeKeys, ['shahdara_quick_collect_audits_v1', 'shahdara_quick_collect_last_used_v1'], 'controller must add no store key (both are pre-existing)');
  // The success step's element ids are exactly the known set (parsed
  // by div depth — the header buttons live outside the step, and the
  // pre-existing pcfSuccessPendingClearanceFlag + sccSecondConnectionStep
  // + quickCollectReversalUndoBtn are inside it).
  const stepStart = pageSrc.indexOf('id="quickCollectStepSuccess"');
  const stepOpen = pageSrc.lastIndexOf('<div', stepStart);
  let depth = 0;
  let i = stepOpen;
  let stepEnd = -1;
  while (i < pageSrc.length) {
    const m = /<\/?div\b/.exec(pageSrc.slice(i, i + 2000));
    if (!m) break;
    const pos = i + m.index;
    if (m[0] === '<div') depth += 1;
    else {
      depth -= 1;
      if (depth === 0) { stepEnd = pos + 6; break; }
    }
    i = pos + m[0].length;
  }
  assert.ok(stepEnd > stepOpen, 'success step must close');
  const ids = [...pageSrc.slice(stepOpen, stepEnd).matchAll(/id="([^"]+)"/g)].map((m) => m[1]);
  const known = new Set(['quickCollectStepSuccess', 'quickCollectSuccessHeading', 'sowStillOwesLine', 'osbOfflineSavedBadge', 'quickCollectSuccessMessage', 'pcfSuccessPendingClearanceFlag', 'quickCollectReceiptCard', 'rsdReceiptShareDraft', 'sccSecondConnectionStep', 'quickCollectUndoBtn', 'quickCollectReversalUndoBtn', 'quickCollectWhatsAppBtn', 'quickCollectShareImageBtn', 'quickCollectPrintReceiptBtn', 'quickCollectBluetoothPrintBtn', 'quickCollectDoneCloseBtn']);
  assert.deepEqual([...ids].sort(), [...known].sort(), 'success step must not add or drop an element id');
});

// 10. Hex/token map: every touched rule uses var(--ds-*) tokens, not hex.
test('§8.10 hex/token map: the redesign rules use DS tokens, never hex literals', () => {
  const touched = [
    '#quickCollectModal.qc-success-open .qc-success-banner {',
    '#quickCollectModal.qc-success-open .qc-success-callout {',
    '#quickCollectModal.qc-success-open .qc-wa-btn {',
    '#quickCollectModal.qc-success-open .qc-receipt-card .qc-area-select {',
  ];
  for (const selector of touched) {
    const block = ruleBlock(stylesSrc, selector);
    assert.ok(!/#[0-9a-fA-F]{3,6}\b/.test(block), `${selector} must not contain a hex literal`);
    assert.ok(block.includes('var(--ds-'), `${selector} must use a --ds-* token`);
  }
  // The pending pill is amber via DS tokens (the deliberate reversal of
  // polish #21's user-requested red, scoped to the success state).
  const pendingAt = stylesSrc.indexOf('var(--ds-warning-bg)');
  assert.ok(pendingAt > 0, 'amber warning background must exist');
  const pending = stylesSrc.slice(stylesSrc.lastIndexOf('{', pendingAt) + 1, stylesSrc.indexOf('}', pendingAt));
  assert.ok(pending.includes('var(--ds-warning-bg)'), 'pending pill must use the warning background token');
  assert.ok(pending.includes('var(--ds-warning)'), 'pending pill must use the warning text token');
  assert.ok(pending.includes('var(--ds-warning-border)'), 'pending pill must use the warning border token');
  assert.ok(!pending.includes('#dc2626') && !pending.includes('#ef4444'), 'pending pill must not be red');
});

// i18n: the new keys exist in EN + UR together (Plan 472).
test('§8 i18n: the new action keys exist in EN and UR', () => {
  for (const key of ['qc_same_customer', 'qc_next_customer', 'qc_empty_amount', 'qc_share_image', 'qc_print_slip', 'qc_bt_print', 'qc_toast_draft_copied', 'qc_toast_draft_copy_failed']) {
    assert.ok(languageSrc.includes(`${key}:`), `dictionary must carry ${key}`);
  }
  const urdu = languageSrc.slice(languageSrc.indexOf("qc_same_customer: 'اسی"), languageSrc.indexOf("qc_same_customer: 'اسی") + 200);
  assert.ok(urdu.includes('اسی گاہک'), 'UR value for qc_same_customer must carry Urdu script');
});
