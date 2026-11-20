// More-audit cleanup — header z-index, empty-state hides, status-board
// banner, cash-in-hand cards, 1-line captions + categories (user spec).
//
// Pins (source-scan + pure-module behaviour):
// - the topbar sits at z-index 50 (NOT 1000); every sticky table cell <= 10
// - the .analytics-panel [hidden] rule exists (the hideable rows carry
//   inline display:flex, which beats the UA [hidden] display:none)
// - pattern-watch / gap-audit / outage-credits / price-notices hide their
//   controls at 0, with the two strand guards (thresholds stay collapsed;
//   gap filter row stays while an explanation exists)
// - the all-Normal board collapses behind a live-count banner
// - cash-in-hand receipts render as .payment-row cards, no <table>
// - all 7 captions are 1-line subtitles with the full text in the
//   audit-explainer; 3 category accordions, collapsed, right members
// - the section-17 More-tab help-tip is gone (its text lives verbatim in
//   the audit-explainer)
//
// This file is NOT a pinning file: it names NO parity total (bare or split)
// anywhere. Parity is asserted only by the existing pin files.
// Fixtures are generic placeholders only ("Test Customer"). No real
// customer name, TID, UUID or amount from any screenshot appears here.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { boardSummaryText } from '../status-board.js';
import { cashInHandReceiptsHtml, formatCashCents } from '../cash-in-hand.js';

const read = (name) => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const html = read('index.html');
const appJs = read('app.js');
const css = read('styles.css') + read('dashboard.css') + read('nav.css')
  + read('components.css') + read('profile-ui.css') + read('screen-router.css');

function fnBody(src, fnName) {
  const start = src.indexOf(`function ${fnName}(`);
  if (start < 0) return '';
  const next = src.indexOf('\nfunction ', start + 10);
  return next < 0 ? src.slice(start) : src.slice(start, next);
}
// Z-index lookup (same rule as the prep repro): the LAST rule whose
// selector list contains the selector exactly, followed by `,` or `{`.
function zIndexOf(cssText, selector) {
  const esc = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`${esc}(?=\\s*[,{])`, 'g');
  let found = null;
  let m;
  while ((m = re.exec(cssText)) !== null) {
    const open = cssText.indexOf('{', m.index + m[0].length);
    if (open === -1) continue;
    const close = cssText.indexOf('}', open);
    if (close === -1) continue;
    const zm = cssText.slice(open, close).match(/z-index:\s*(\d+)/);
    if (zm) found = Number(zm[1]);
  }
  return found;
}
function captionAfter(heading) {
  const i = html.indexOf(heading);
  if (i < 0) return null;
  const seg = html.slice(i, i + 4000);
  const m = seg.match(/<p class="chart-caption">([\s\S]*?)<\/p>/);
  return m ? m[1] : null;
}
function explainerAfter(heading) {
  const i = html.indexOf(heading);
  if (i < 0) return null;
  const seg = html.slice(i, i + 9000);
  const m = seg.match(/<details class="audit-explainer"><summary>ⓘ How this audit rule works<\/summary><p class="chart-caption">([\s\S]*?)<\/p><\/details>/);
  return m ? m[1] : null;
}

// 1 — the header sits at 50, above every sticky table cell, below the
// drawer / banner / scroll-top / bottom-nav / toast layer.
test('More-audit: topbar z-index is 50, above the sticky table cells', () => {
  const headerZ = zIndexOf(css, '.topbar');
  assert.equal(headerZ, 50, 'header must be 50, not the suggested 1000');
  const tableSticky = {
    '.table-scroll thead th': zIndexOf(css, '.table-scroll thead th'),
    '.table-scroll th:first-child': zIndexOf(css, '.table-scroll th:first-child'),
    '.table-scroll thead th:first-child': zIndexOf(css, '.table-scroll thead th:first-child'),
    '.roll-forward-table thead th:first-child': zIndexOf(css, '.roll-forward-table thead th:first-child'),
    '.customer-roster-table thead th': zIndexOf(css, '.customer-roster-table thead th'),
    '.audit-table th': zIndexOf(css, '.audit-table th'),
  };
  const tableMax = Math.max(...Object.values(tableSticky));
  assert.ok(tableMax <= 10, `every table-sticky z-index stays <= 10 (max ${tableMax})`);
  assert.ok(headerZ > tableMax, 'header must beat every sticky table cell');
  const srZ = zIndexOf(css, '.sr-screen-header');
  assert.ok(srZ > tableMax && srZ < headerZ, 'sticky sub-header sits between the table cells and the header');
  for (const [sel, v] of [['.nav-drawer', zIndexOf(css, '.nav-drawer')], ['.pwa-install-banner', zIndexOf(css, '.pwa-install-banner')], ['.scroll-top-button', zIndexOf(css, '.scroll-top-button')], ['.mobile-bottom-nav', zIndexOf(css, '.mobile-bottom-nav')], ['#toast', zIndexOf(css, '#toast')]]) {
    assert.ok(v === null || v > headerZ, `${sel} must stay above the header`);
  }
});

// 2 — the load-bearing [hidden] rule exists.
test('More-audit: .analytics-panel [hidden] defeats the inline display:flex rows', () => {
  assert.ok(css.includes('.analytics-panel [hidden]{display:none!important}'), 'scoped [hidden] rule missing');
});

// 3 — pattern-watch hides at 0 events; the thresholds stay collapsed.
test('More-audit: pattern-watch hides Export/filters/review at 0 events, thresholds stay', () => {
  for (const id of ['patternWatchFilterRow', 'patternWatchThresholds', 'patternWatchReviewRow']) {
    assert.ok(html.includes(`id="${id}"`), `${id} missing`);
  }
  assert.ok(html.includes('⚙️ Thresholds ▾'), 'thresholds summary missing');
  const render = fnBody(appJs, 'renderPatternWatch');
  assert.ok(render.includes('patternWatchExportBtn.hidden = patternEmpty'), 'Export must hide on patternEmpty');
  assert.ok(render.includes('events.length === 0'), 'hide condition must be the unfiltered event count');
  assert.ok(render.includes('patternWatchFilterRow.hidden = patternEmpty'), 'filter row must hide at 0 events');
  assert.ok(render.includes('patternWatchReviewRow.hidden = patternEmpty'), 'review row must hide at 0 events');
  assert.ok(!render.includes('patternWatchThresholds.hidden'), 'the thresholds details must never be hidden (strand guard)');
  assert.ok(!html.includes('id="patternWatchThresholds" hidden'), 'thresholds details must stay visible at 0 events');
});

// 4 — gap-audit hides at 0 gaps; the filter row stays while an
// explanation exists.
test('More-audit: gap-audit hides Export + filter row at 0 gaps, stays with explanations', () => {
  assert.ok(html.includes('id="receiptGapFilterRow"'), 'receiptGapFilterRow missing');
  const render = fnBody(appJs, 'renderReceiptGapAudit');
  assert.ok(render.includes('receiptGapExportBtn.hidden = gapTotal === 0'), 'Export must hide at 0 gaps');
  assert.ok(render.includes('receiptGapFilterRow.hidden = gapTotal === 0 && !gapHasExplanations'), 'filter row must stay while an explanation exists');
  assert.ok(render.includes('gapTotal'), 'gapTotal must count plain + REC-run gaps');
});

// 5 — outage-credits hides at 0 records; the form sits behind
// '+ Build Credit Record'.
test('More-audit: outage-credits hides Export + action row at 0 records', () => {
  assert.ok(html.includes('id="outageCreditCreateDetails"'), 'outageCreditCreateDetails missing');
  assert.ok(html.includes('+ Build Credit Record'), 'create summary must read + Build Credit Record');
  assert.ok(html.includes('id="outageCreditActionRow"'), 'outageCreditActionRow missing');
  const render = fnBody(appJs, 'renderOutageCredits');
  assert.ok(render.includes('outageCreditExportBtn.hidden = outageEmpty'), 'Export must hide at 0 records');
  assert.ok(render.includes('outageCreditActionRow.hidden = outageEmpty'), 'action row must hide at 0 records');
});

// 6 — price-notices hides at 0 notices; the draft sits behind
// '+ Draft Notice'.
test('More-audit: price-notices hides Export/Log send/Remove at 0 notices', () => {
  assert.ok(html.includes('id="priceNoticeDraftDetails"'), 'priceNoticeDraftDetails missing');
  assert.ok(html.includes('+ Draft Notice'), 'draft summary must read + Draft Notice');
  const render = fnBody(appJs, 'renderPriceNotices');
  assert.ok(render.includes('priceNoticeExportBtn.hidden = noticesEmpty'), 'Export must hide at 0 notices');
  assert.ok(render.includes('priceNoticeSendBtn.hidden = noticesEmpty'), 'Log send must hide at 0 notices');
  assert.ok(render.includes('priceNoticeRemoveBtn.hidden = noticesEmpty'), 'Remove notice must hide at 0 notices');
});

// 7 — the all-Normal banner carries the LIVE count; Export/Print stay.
test('More-audit: all-Normal board collapses behind a live-count banner', () => {
  for (const id of ['statusBoardAllNormalBanner', 'statusBoardAllNormalCount', 'statusBoardViewBoardBtn', 'statusBoardFilterRow']) {
    assert.ok(html.includes(`id="${id}"`), `${id} missing`);
  }
  assert.ok(html.includes('✅ All <span id="statusBoardAllNormalCount"></span> Mohallas Normal'), 'banner must read the live count');
  assert.ok(html.includes('id="statusBoardExportBtn"'), 'Export board CSV must stay visible');
  assert.ok(html.includes('id="statusBoardPrintBtn"'), 'Print board must stay visible');
  const render = fnBody(appJs, 'renderStatusBoard');
  assert.ok(render.includes('boardAllNormal'), 'render must compute boardAllNormal from the live rows');
  assert.ok(render.includes('statusBoardExpanded'), 'render must track the expanded state');
  assert.ok(render.includes('statusBoardAllNormalCount'), 'render must fill the count span');
  assert.ok(render.includes('board.rows.length'), 'the count must be the live row total, never a constant');
  const fixture23 = { rows: Array.from({ length: 23 }, (_, i) => ({ key: `m${i}`, mohalla: `Mohalla ${i + 1}`, status: 'normal', sources: [], outageId: '', windowId: '', sourceLabel: '' })) };
  assert.equal(boardSummaryText(fixture23), '23 mohallas on the board · 23 normal');
});

// 8 — cash-in-hand receipts render as .payment-row cards, no <table>.
test('More-audit: cash-in-hand receipts are compact cards, not a table', () => {
  const fixture = [{ date: '2026-11-19', customerName: 'Test Customer', collector: 'Test Collector', amountCents: 80000 }];
  const out = cashInHandReceiptsHtml(fixture);
  assert.ok(!out.includes('<table'), 'no table may remain');
  assert.ok(out.includes('payment-list') && out.includes('payment-row') && out.includes('payment-main'), 'cards must use the profile row pattern');
  for (const field of ['Test Customer', '2026-11-19', 'Test Collector', 'Rs. 800.00']) {
    assert.ok(out.includes(field), `card must carry ${field}`);
  }
  assert.equal(formatCashCents(80000), 'Rs. 800.00');
  assert.ok(cashInHandReceiptsHtml([]).includes('No unhanded-over cash receipts for this day.'), 'empty state unchanged');
});

// 9 — all 7 captions are 1-line subtitles; the full text lives verbatim
// in the audit-explainer.
const CAPTIONS = [
  ['unusualFlagHeading', 'Payments that differ from their bill, flagged.',
    "Read-only review list, computed fresh from the customers' own bills and payments: a payment that differs from its bill by more than the tolerance, a payment with no bill above the threshold, or several payments for one customer on one day. Flagging never blocks a payment, never changes an amount, and never creates a suspense item or a dispute case. Clearing a flag only records who reviewed it and why — the payment record itself is never touched."],
  ['patternWatchHeading', 'Read-only view of void and correction concentrations.',
    'Read-only pattern view from the operator audit log and the per-payment correction history: counts grouped by day, by operator, and by customer. A group strictly above the operator-set threshold appears as a review item. The view accuses nobody, blocks nothing, and changes no void, correction, or payment record. Reviewing only records who reviewed it and the outcome.'],
  ['receiptGapHeading', 'Read-only check for missing receipt numbers.',
    'Read-only sequence audit over plain-numbered field receipts and stored REC- references: every gap in the checked run is listed with its status — voided with its void record, explained by an operator note, or unexplained. The audit creates no receipt, deletes none, and never changes a payment. A stored REC- reference is audited in its own month-and-customer run; a generated REC- reference is derived from its payment id, so its tail is not a sequence and it never enters the audit. Where no plain-numbered or stored REC- receipts exist the audit says so plainly instead of inventing numbers. Issued numbers show their receipt delivery status where one is recorded.'],
  ['statusBoardHeading', 'Live mohalla status from outages and windows.',
    'Read-only board, recomputed fresh from the open outage records and the active maintenance windows: each mohalla shows as normal, degraded (fault being worked on), in outage, or under planned maintenance, with the linked record named. The board sets no status by itself and changes no ticket, billing, or customer record — clearing a source record clears its board entry. A mohalla with no open outage or active window shows as normal, never as guessed. Rows show exactly the area names recorded; a segment name typed as an area appears under that name until the record is corrected at its source.'],
  ['outageCreditHeading', 'One written credit rule per resolved outage.',
    'One written rule per resolved outage: the operator-set qualifying threshold, the downtime, the affected mohallas, and the pro-rata formula (downtime hours ÷ hours in the month × monthly package price, capped at the monthly price). A customer outside the affected mohallas never receives a credit, and downtime below the threshold credits nobody. This record never rewrites a past bill — the credit lands only on the next bill through the existing concession path, and marking applied here only records that path\'s reference. Planned maintenance windows are excluded unless the operator records a reason to include one.'],
  ['cashInHandHeading', "Operator-set limit on the collector's cash.",
    "Operator-set limit on the collector's unhanded-over cash for the day. When the held cash reaches the limit, Field Mode shows a plain handover prompt with the amount held and the route to the cash handover screen. The prompt advises only: it never locks collection, blocks a payment, or changes any total, and the denomination count still records what is actually handed over. The prompt clears once a handover is recorded for the day."],
  ['priceNoticeHeading', 'Bilingual advance-notice draft for price changes.',
    'Bilingual advance-notice draft for every recorded price change: package, old price, new price, and effective date taken from the price history, plus one operator-written reason line. The draft is prepared here and sent by the operator through the existing WhatsApp route or the mohalla announcement route — nothing is sent automatically, and the notice changes no price or bill by itself. A notice whose old price is unrecorded stays visible as a draft but cannot be saved until its old price is recorded in the history.'],
];
test('More-audit: all 7 captions are 1-line subtitles, full text in the explainer', () => {
  for (const [heading, subtitle, full] of CAPTIONS) {
    assert.ok(subtitle.length <= 56, `${heading} subtitle must fit one line at 360px`);
    const visible = captionAfter(heading);
    assert.ok(visible !== null, `visible caption missing after ${heading}`);
    assert.equal(visible.replace(/<[^>]+>/g, '').trim(), subtitle, `visible caption for ${heading} must be the subtitle`);
    const kept = explainerAfter(heading);
    assert.ok(kept !== null, `audit-explainer missing after ${heading}`);
    assert.equal(kept, full, `audit-explainer for ${heading} must hold the full original verbatim`);
  }
});

// 10 — three category accordions, collapsed, right members; cash-in-hand
// moved to sit with the price notices.
test('More-audit: 3 category accordions, collapsed, right members, cash-in-hand moved', () => {
  for (const id of ['analyticsCategoryAudit', 'analyticsCategoryOutages', 'analyticsCategoryNotices']) {
    assert.ok(html.includes(`id="${id}"`), `${id} missing`);
  }
  assert.ok(!/analytics-category"[^>]*\bopen\b/.test(html), 'no category may start open');
  const at = (id) => html.indexOf(`id="${id}"`);
  const inRange = (pos, lo, hi) => pos > lo && pos < hi;
  const termsAt = html.indexOf('aria-labelledby="termsAckHeading"');
  assert.ok(inRange(at('unusualFlagHeading'), at('analyticsCategoryAudit'), at('analyticsCategoryOutages')), 'unusual-flag belongs to Audit & Guardrails');
  assert.ok(inRange(at('patternWatchHeading'), at('analyticsCategoryAudit'), at('analyticsCategoryOutages')), 'pattern-watch belongs to Audit & Guardrails');
  assert.ok(inRange(at('receiptGapHeading'), at('analyticsCategoryAudit'), at('analyticsCategoryOutages')), 'gap-audit belongs to Audit & Guardrails');
  assert.ok(inRange(at('statusBoardHeading'), at('analyticsCategoryOutages'), at('analyticsCategoryNotices')), 'status-board belongs to Outages & Service Status');
  assert.ok(inRange(at('outageCreditHeading'), at('analyticsCategoryOutages'), at('analyticsCategoryNotices')), 'outage-credits belong to Outages & Service Status');
  assert.ok(inRange(at('cashInHandHeading'), at('analyticsCategoryNotices'), termsAt), 'cash-in-hand belongs to Notices & Field Safety');
  assert.ok(inRange(at('priceNoticeHeading'), at('analyticsCategoryNotices'), termsAt), 'price-notices belong to Notices & Field Safety');
  assert.ok(at('cashInHandHeading') > at('outageCreditHeading') && at('cashInHandHeading') < at('priceNoticeHeading'), 'cash-in-hand must sit after outage-credits, before price-notices');
});

// 11 — the section-17 More-tab help-tip is gone; its text lives verbatim
// in the audit-explainer (keeping both would show the sentences twice).
test('More-audit: section-17 help-tip removed, text absorbed into the explainer', () => {
  const secStart = html.indexOf('id="unusualFlagHeading"');
  const secEnd = html.indexOf('</section>', secStart);
  const sec = html.slice(secStart, secEnd);
  assert.ok(!sec.includes('class="help-tip"'), 'the More-tab help-tip must be gone from section 17');
  assert.ok(!sec.includes('How unusual payment flags work'), 'no help-tip aria-label may remain in section 17');
  const kept = explainerAfter('unusualFlagHeading');
  assert.ok(kept !== null, 'audit-explainer missing after the unusual-flag heading');
  assert.equal(kept.length, 449, 'the explainer must hold the full 449-char original');
});

// 12 — totals: 11 explainers (4 month-end + 7 here), 9 create-details
// (7 on the new base + 2 here).
test('More-audit: explainer and create-details totals', () => {
  assert.equal((html.match(/<details class="audit-explainer">/g) || []).length, 11);
  assert.equal((html.match(/registry-create-details/g) || []).length, 9);
});
