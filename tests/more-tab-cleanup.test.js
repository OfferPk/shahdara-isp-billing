// More-tab cleanup — Suspensions, Moves, Fair-Use Guard, Duplicate Check
// & Payment Flags (user spec 2026-11-19).
//
// Pins (source-scan + pure-module behaviour):
// - the suspension mutation row (not the create form) is the hidden-at-0 row
// - move Export + filters + mutation rows hide at 0 (unfiltered total);
//   the 12-field create form collapses behind "+ Record Move"
// - "(Plan 17)" is gone from visible text (bare "Plan 17" references stay)
// - Retention Rs. shows only for a retention move; Wallet reference (TID)
//   only for a non-cash channel — both live on change, both clear on hide
// - the three long captions are exactly their first sentences; the rest
//   lives verbatim in the new (i) tooltips
// - guardrail config + manual check forms sit in closed-by-default accordions
// - hold-guard / duplicate-warning Exports hide at 0; unusual flags show
//   Top 5 with a live-count [Show all N] toggle
// - the five (i) icons sit next to their h3 (28px scoped rule already
//   exists from Month-End #1553 — this item adds NO CSS rule)
//
// This file is NOT a pinning file: it names NO parity total (bare or split)
// anywhere. Parity is asserted only by the existing pin files.
// Fixtures are generic placeholders only ("Test Customer"). No real
// customer name, TID, UUID or amount from any screenshot appears here.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { flagsHtml } from '../unusual-payment-flags.js';
import { normalizeMove } from '../move-transfers.js';
import { TRANSLATIONS } from '../nav-language.js';

const read = (name) => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const html = read('index.html');
const appJs = read('app.js');
const css = read('styles.css');

function fnBody(src, fnName) {
  const start = src.indexOf(`function ${fnName}(`);
  if (start < 0) return '';
  const next = src.indexOf('\nfunction ', start + 10);
  return next < 0 ? src.slice(start) : src.slice(start, next);
}
// Segment of the div carrying an id: from its opening tag to the next
// top-level sibling marker (enough to tell which controls it wraps).
function divSegmentWith(id) {
  const i = html.indexOf(`id="${id}"`);
  if (i < 0) return null;
  const open = html.lastIndexOf('<div', i);
  const tail = html.slice(open, open + 3000);
  const end = tail.search(/<\/div>\s*<(div|details|section|p id=)/);
  return end < 0 ? tail : tail.slice(0, end);
}
function captionAfter(heading) {
  const i = html.indexOf(heading);
  if (i < 0) return null;
  const seg = html.slice(i, i + 4000);
  const m = seg.match(/<p class="chart-caption">([\s\S]*?)<\/p>/);
  return m ? m[1] : null;
}
function tooltipAfter(heading) {
  const i = html.indexOf(heading);
  if (i < 0) return null;
  const seg = html.slice(i, i + 6000);
  const m = seg.match(/<span class="help-tip-content"[^>]*>([\s\S]*?)<\/span>/);
  return m ? m[1] : null;
}
function detailsEnclosing(elementId) {
  const i = html.indexOf(`id="${elementId}"`);
  if (i < 0) return null;
  const open = html.lastIndexOf('<details', i);
  if (open < 0) return null;
  const close = html.indexOf('</details>', i);
  const nextDetails = html.indexOf('<details', i);
  if (close < 0 || (nextDetails >= 0 && nextDetails < close)) return null;
  return html.slice(open, html.indexOf('>', open) + 1);
}

// 1(a) — the suspension mutation row is the hidden-at-0 row.
test('More-tab: suspensionActionRow wraps the mutation row, not the create form', () => {
  const seg = divSegmentWith('suspensionActionRow');
  assert.ok(seg, 'suspensionActionRow id missing');
  assert.ok(seg.includes('suspensionReconnectBtn'), 'mutation row must hold Reconnect customer');
  assert.ok(seg.includes('suspensionReopenBtn'), 'mutation row must hold Reopen suspension');
  assert.ok(seg.includes('suspensionRemoveBtn'), 'mutation row must hold Remove suspension');
  assert.ok(!seg.includes('suspensionRecordBtn'), 'mutation row must not hold the create form');
  const render = fnBody(appJs, 'renderSuspensions');
  assert.ok(render.includes("setRegistryRowVisible($('#suspensionActionRow')"), 'render must hide the row');
  assert.ok(render.includes('!suspensionsEmpty'), 'hide condition is the unfiltered total');
  // The create form stays reachable at 0 behind its own details.
  assert.ok(html.includes('id="suspensionCreateDetails"'), 'suspension create details missing');
});

// 1(b) — move hide at 0 + collapse behind "+ Record Move".
test('More-tab: move Export + filters + mutation rows hide at 0 moves', () => {
  for (const id of ['moveFilterRow', 'moveActionRow', 'moveCheckRow']) {
    assert.ok(html.includes(`id="${id}"`), `missing move row id ${id}`);
  }
  const render = fnBody(appJs, 'renderMoveTransfers');
  for (const id of ['moveFilterRow', 'moveActionRow', 'moveCheckRow']) {
    assert.ok(render.includes(`$('#${id}')`), `render must hide ${id}`);
  }
  assert.ok(render.includes('entries.length === 0'), 'hide condition is the unfiltered total');
  assert.ok(render.includes('.hidden = entries.length === 0'), 'Export hides with .hidden at 0');
});

test('More-tab: move 12-field create form collapses behind "+ Record Move"', () => {
  assert.ok(html.includes('id="moveCreateDetails"'), 'move create details missing');
  assert.ok(html.includes('>+ Record Move</summary>'), 'summary must read "+ Record Move"');
  const encloses = detailsEnclosing('moveRecordBtn');
  assert.ok(encloses, 'Record button must sit inside the create details');
  assert.ok(!encloses.includes(' open'), 'create details is closed by default');
  for (const id of ['moveId', 'moveCustomer', 'moveRequestId', 'moveConnectionId', 'moveOldMohalla',
    'moveOldAddress', 'moveNewMohalla', 'moveNewAddress', 'movePauseStart', 'moveExpectedReconnect',
    'moveTreatment', 'moveRetention']) {
    assert.ok(html.includes(`id="${id}"`), `create form missing field ${id}`);
  }
  const render = fnBody(appJs, 'renderMoveTransfers');
  assert.ok(render.includes('moveCreateDetails') && render.includes('.open = false'), 'details closes on save');
});

// 2(a) — "(Plan 17)" gone from visible text.
test('More-tab: "(Plan 17)" is gone; the move sentence still reads as a sentence', () => {
  assert.ok(!html.includes('(Plan 17)'), '"(Plan 17)" still present in visible text');
  assert.ok(html.includes('The connection update itself lives in the connection register; only its record id is kept here.'),
    'move caption sentence must survive without the parenthetical');
  // The bare form in the field-visit jobs + capacity forecast sections is
  // legitimate and stays — it is not the leak.
  assert.ok(html.includes('Plan 17'), 'bare Plan 17 references must stay untouched');
});

// 2(b) — Retention Rs. conditional on the gap treatment.
test('More-tab: Retention Rs. shows only for a retention move, live on change', () => {
  assert.ok(html.includes('id="moveRetentionLabel"'), 'Retention label needs an id');
  const render = fnBody(appJs, 'renderMoveTransfers');
  assert.ok(render.includes('moveRetentionLabel'), 'render must wire the Retention label');
  assert.ok(render.includes("=== 'retention'"), 'Retention shows only for a retention move');
  assert.ok(render.includes('setRegistryFieldVisible'), 'wiring uses the shipped helper (clear on hide)');
  assert.ok(appJs.includes("$('#moveTreatment')?.addEventListener('change'"), 'treatment change re-evaluates live');
});

// 2(c) — Wallet reference (TID) conditional on a non-cash channel.
test('More-tab: Wallet reference (TID) shows only for a non-cash channel, live on change', () => {
  assert.ok(html.includes('id="duplicateWarningReferenceLabel"'), 'TID label needs an id');
  const render = fnBody(appJs, 'renderDuplicateWarning');
  assert.ok(render.includes('duplicateWarningReferenceLabel'), 'render must wire the TID label');
  assert.ok(render.includes("!== 'Cash'"), 'TID shows for any non-cash channel');
  assert.ok(render.includes('setRegistryFieldVisible'), 'wiring uses the shipped helper (clear on hide)');
  assert.ok(appJs.includes("$('#duplicateWarningChannel')?.addEventListener('change'"), 'channel change re-evaluates live');
  // No Raast option exists in THIS channel select — the rule is !== 'Cash',
  // not a Raast case. (Raast appears in other sections' payment selects;
  // those are out of scope and untouched.)
  const channelSel = html.slice(html.indexOf('id="duplicateWarningChannel"'), html.indexOf('</select>', html.indexOf('id="duplicateWarningChannel"')));
  assert.ok(!channelSel.includes('Raast'), 'no Raast option must be added to the duplicate-warning channel select');
});

// 3(a) — captions condensed to their first sentences; rest in the tooltips.
test('More-tab: three long captions are exactly their first sentences', () => {
  const cases = [
    ['Hold history and fair-use guard',
      'Read-only history per customer, drawn from the vacation holds and move pauses: every hold in date order with its reason and billing treatment.',
      'The guardrails never block by themselves'],
    ['Near-duplicate payment warning at entry time',
      'A warning only, shown before a payment is saved: same customer, same amount, and same channel within the operator-set window (same day by default), or the same wallet reference already recorded, surfaces the earlier payment for comparison.',
      'Voided payments never warn.'],
    ['Unusual payment flag for review',
      "Read-only review list, computed fresh from the customers' own bills and payments: a payment that differs from its bill by more than the tolerance, a payment with no bill above the threshold, or several payments for one customer on one day.",
      'Clearing a flag only records who reviewed it and why'],
  ];
  for (const [heading, first, remainder] of cases) {
    const cap = captionAfter(heading);
    assert.ok(cap !== null, `caption missing after ${heading}`);
    assert.equal(cap.replace(/<[^>]+>/g, '').trim(), first, `caption for ${heading} must be exactly its first sentence`);
    const tip = tooltipAfter(heading);
    assert.ok(tip !== null, `tooltip missing after ${heading}`);
    assert.ok(tip.includes(remainder), `tooltip for ${heading} must hold the removed sentences verbatim`);
  }
});

// 3(b) — config + check forms in closed-by-default accordions.
test('More-tab: guardrail config + manual check forms sit in closed accordions', () => {
  for (const [elId, label] of [
    ['holdGuardMaxDays', 'Guardrail settings'],
    ['holdGuardCheckStart', 'Check a new hold'],
    ['duplicateWarningWindow', 'Check a new payment'],
    ['duplicateWarningReason', 'Check a new payment'],
  ]) {
    const d = detailsEnclosing(elId);
    assert.ok(d !== null, `${elId} must sit inside a <details> accordion`);
    assert.ok(!d.includes(' open'), `${elId} accordion must be closed by default`);
    assert.ok(html.slice(html.indexOf(`id="${elId}"`) - 2000, html.indexOf(`id="${elId}"`)).includes('<summary'),
      `${elId} accordion needs its summary`);
  }
  // The hold-guard Customer picker is the view control — it stays visible
  // outside the accordions (no <details> encloses it).
  const picker = html.indexOf('id="holdGuardCustomer"');
  assert.ok(picker >= 0, 'hold-guard Customer picker missing');
  assert.equal(detailsEnclosing('holdGuardCustomer'), null, 'Customer picker must stay outside the accordions');
  const guardrailsOpen = html.indexOf('<summary class="secondary-button registry-create-summary">Guardrail settings</summary>');
  assert.ok(guardrailsOpen > 0 && guardrailsOpen > picker, 'Guardrail settings accordion follows the picker');
  // The acknowledged-warnings list and the recorded-overrides log stay
  // visible outside the accordions (they are the mutation logs, not forms).
  assert.ok(html.includes('id="duplicateWarningAckBody"'), 'ack list missing');
  assert.ok(html.includes('id="holdGuardOverridesBody"'), 'overrides log missing');
});

// 3(c) — Exports hide at 0.
test('More-tab: hold-guard + duplicate-warning Exports hide at 0', () => {
  const hg = fnBody(appJs, 'renderHoldGuard');
  assert.ok(hg.includes('holdGuardExportBtn'), 'render must reference the hold-guard Export');
  assert.ok(hg.includes('.hidden = shown.length === 0'), 'hold-guard Export hides at 0 in picked history');
  const dw = fnBody(appJs, 'renderDuplicateWarning');
  assert.ok(dw.includes('duplicateWarningExportBtn'), 'render must reference the duplicate-warning Export');
  assert.ok(dw.includes('.hidden = !lastDuplicateWarning'), 'duplicate-warning Export hides until a check has warned');
});

// 4(a) — unusual flags: Top 5 + live-count toggle.
test('More-tab: unusual flags show Top 5 with a live-count toggle', () => {
  const render = fnBody(appJs, 'renderUnusualPaymentFlags');
  assert.ok(render.includes('slice(0, 5)'), 'render must slice to Top 5 by default');
  assert.ok(render.includes('unusualFlagShowAll'), 'render must carry the show-all flag');
  assert.ok(html.includes('id="unusualFlagShowAllBtn"'), 'toggle button missing');
  assert.ok(render.includes('unusualFlagShowAllBtn'), 'render must drive the toggle');
  assert.ok(render.includes('Show all ${'), 'toggle label reads the live filtered count');
  assert.ok(!appJs.includes('Show all 62'), 'toggle label must never hardcode a count');
  assert.ok(render.includes('of ${shown.length}'), 'summary reads "showing 5 of N" collapsed');
});

// 4(b) — the five (i) icons sit next to their h3, not inside the caption.
test('More-tab: five (i) icons sit next to their h3, 28px scoped rule already exists', () => {
  for (const heading of ['Equipment warranty and supplier return', 'End-of-service equipment recovery queue',
    'Customer-requested vacation', 'Hold expiry and resume queue', 'Non-payment suspension record']) {
    const i = html.indexOf(heading);
    assert.ok(i >= 0, `heading missing: ${heading}`);
    const seg = html.slice(i, i + 3000);
    const cap = seg.match(/<div class="chart-caption">([\s\S]*?)<\/div>/);
    assert.ok(cap !== null, `caption div missing after ${heading}`);
    assert.ok(!cap[1].includes('help-tip'), `(i) must be out of the caption div for ${heading}`);
  }
  // The 28px scoped rule already exists (Month-End #1553) — this item adds
  // NO CSS rule; the base 40px rule is untouched.
  assert.ok(css.includes('.analytics-panel .help-icon { width: 28px; height: 28px;'), 'scoped 28px rule must exist');
  const base = css.match(/\.help-icon\{([^}]*)\}/);
  assert.ok(base && base[1].includes('width:40px') && base[1].includes('height:40px'), 'base .help-icon rule stays 40px');
});

// Guards.
test('More-tab: EN/UR parity tables agree (0 new keys; totals pinned elsewhere)', () => {
  assert.equal(Object.keys(TRANSLATIONS.en).length, Object.keys(TRANSLATIONS.ur).length,
    'EN/UR parity must agree — this item adds no keys');
});

test('More-tab: the four existing conditional fields stay wired', () => {
  for (const id of ['jobCostMaterialOtherLabel', 'rmaReplacementSerialLabel',
    'rmaReplacementConnectionIdLabel', 'rmaReasonLabel', 'vacationRetentionLabel']) {
    assert.ok(appJs.includes(id), `existing conditional field unwired: ${id}`);
  }
});

test('More-tab: flagsHtml still renders every row it is given', () => {
  assert.ok(flagsHtml([]).includes('No unusual payments'), 'empty flags must render the empty state');
  const six = flagsHtml([1, 2, 3, 4, 5, 6].map((n) => ({
    paymentId: `P-${n}`, customerId: 'C-1', customerName: 'Test Customer', date: '2026-11-01',
    amountCents: 300000, billMonth: '2026-11', reason: 'amount_differs', mohalla: 'Charyaa',
    reasons: ['amount_differs'], reasonText: 'Amount far from the bill',
  })));
  assert.equal((six.match(/<tr>/g) || []).length - 1, 6, 'flagsHtml must render all 6 rows given');
});

test('More-tab: normalizeMove semantics unchanged', () => {
  const mk = (o) => ({
    id: 'M-1', customerId: 'C-1', requestId: '', connectionId: '', oldMohalla: 'Charyaa',
    oldAddress: 'Old street 1', newMohalla: 'Gangall', newAddress: 'New street 2',
    pauseStartDate: '2026-11-01', expectedReconnectDate: '2026-11-20', treatment: 'no_bill',
    retentionAmount: '', status: 'pending', ...o,
  });
  assert.equal(normalizeMove(mk({ retentionAmount: '500' }))?.retentionCents, null, 'retention dropped for no_bill');
  assert.equal(normalizeMove(mk({ treatment: 'retention' })), null, 'retention without a positive charge refused');
  assert.equal(normalizeMove(mk({ treatment: 'retention', retentionAmount: '500' }))?.retentionCents, 50000, 'retention kept for a retention move');
});
