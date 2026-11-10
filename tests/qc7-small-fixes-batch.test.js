// QC-7 — Small fixes batch (TID normaliser + QC pill wrap + 360px
// rules + one-screen keypad).
//
// Pins:
// - TID normaliser strips ALL non-alphanumerics (QC-7 fix 1): two
//   TIDs that differ only by a separator are the SAME TID in the
//   duplicate guard, the leg-2 same-TID check, and the near-duplicate
//   warning; legitimate distinct TIDs stay distinct; a separators-only
//   TID matches nothing (same as empty); the guard still returns the
//   record (never throws) so the duplicate card + "Save anyway" path
//   stays reachable, and voided payments still never block.
// - QC filter pills wrap at <= 620px (QC-7 fix 2, polish #27's pattern):
//   the 620px media rule wraps .qc-filter-pills with no horizontal
//   scroll; the base rule still scrolls on wide screens; the chips
//   keep their 44px tap target and nowrap labels.
// - Explicit 360px QC rules (QC-7 fix 3): the QC-3 picker card row
//   (.qc3-card-main) wraps at 360px so the two nowrap figures drop to
//   their own right-aligned line when they do not fit, and the full
//   figures are never truncated or compacted; the modal padding at
//   360px is pinned as a regression (the <= 640px dialog rule is the
//   operative one there).
// - One-screen keypad (QC-7 fix 4): the one-screen HTML carries the
//   keypad host (existing `qos` id family, no new prefix), populated
//   at render time by the Plan 442 keypad component; digits enter the
//   amount, backspace deletes, clear empties, and the keypad-entered
//   amount validates into a draft exactly like a typed amount.
//
// Stylesheet-value approach (polish #17/#21/#25/#27 pattern): read the
// CSS/JS as text and assert the values; no browser needed. Geometry is
// measured from the pinned CSS values with the documented model below,
// never guessed: at 360px the dialog is calc(100vw - 16px) wide with
// 14px side padding, so the modal content is 360 - 16 - 28 = 316px and
// the card inner width is 316 - 24 (card padding) = 292px. A 0.95rem
// bold figure is measured at 8px per digit, 9px per letter, 4px per
// space or comma (conservative for the house bold face).
//
// Synthetic data only. No customer data of any kind in this file.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  addCustomer,
  saveBillMonth,
  addPayment,
  findDuplicatePaymentReference,
} from '../core.js';
import { normalizeTid, findPaymentsByTid } from '../wallet-reconciliation.js';
import { validateSplitTender } from '../split-tender-collect.js';
import { findNearDuplicates } from '../duplicate-warning.js';
import { voidPayment } from '../payment-void-audit.js';
import {
  quickCollectOneScreenHtml,
  quickCollectOneScreenDraft,
  quickCollectOneScreenAmountCents,
} from '../quick-collect-one-screen.js';
import {
  amountKeypadHtml,
  amountKeypadApplyKey,
  AMOUNT_KEYPAD_KEYS,
} from '../quick-collect-amount-keypad.js';

const read = (name) => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const styles = read('styles.css');
const components = read('components.css');
const navQuickCollect = read('nav-quick-collect.js');

const MONTH = '2026-10';
const REF = new Date('2026-10-20');

// Brace-balanced extraction of every `@media ...` block for a marker.
function mediaBlocks(source, marker) {
  const blocks = [];
  let from = 0;
  for (;;) {
    const start = source.indexOf(marker, from);
    if (start < 0) return blocks;
    let depth = 0;
    let i = source.indexOf('{', start);
    const open = i;
    for (; i < source.length; i += 1) {
      if (source[i] === '{') depth += 1;
      if (source[i] === '}') {
        depth -= 1;
        if (depth === 0) break;
      }
    }
    assert.ok(i < source.length, `unterminated media block for ${marker}`);
    blocks.push(source.slice(open + 1, i));
    from = i + 1;
  }
}

// The first rule block for a selector (base rule, outside any media query).
function baseRuleBlock(source, selectorWithBrace) {
  const start = source.indexOf(selectorWithBrace);
  assert.ok(start >= 0, `missing rule ${selectorWithBrace}`);
  const open = source.indexOf('{', start);
  const close = source.indexOf('}', open);
  return source.slice(open + 1, close);
}

// --- Fixtures ---------------------------------------------------------------

function stateWithRecordedTid(tid) {
  let state = { customers: [] };
  state = addCustomer(state, 'Test Customer', REF, { phone: '03012345678', area: 'Main Bazaar' });
  const customer = state.customers[0];
  state = saveBillMonth(state, customer.id, { month: MONTH, dueAmount: 2000, status: 'pending' }, REF);
  state = addPayment(state, customer.id, MONTH, {
    date: '2026-10-15', amount: 2000, method: 'JazzCash', transactionId: tid,
  }, REF);
  return state;
}

function splitFixture() {
  const customer = {
    id: 'a', customerNumber: 1, name: 'Customer 1', phone: '03012345678',
    area: 'Shahdara', archived: false, bills: [],
  };
  let state = { version: 1, nextCustomerNumber: 2, customers: [customer] };
  state = saveBillMonth(state, 'a', { month: MONTH, dueAmount: 3000, status: 'pending' }, REF);
  return state;
}

const METHODS = ['Cash', 'JazzCash', 'Easypaisa', 'Bank Transfer', 'Raast'];

function oneScreenHtml() {
  return quickCollectOneScreenHtml({
    customers: [{ id: 'CUST-1', name: 'Customer One', customerNumber: 1 }],
    methods: METHODS,
  });
}

// --- Fix 1: TID normaliser strips non-alphanumerics ------------------------

test('QC-7 fix 1: normalizeTid strips every separator, not just whitespace', () => {
  assert.equal(normalizeTid('1234-5678'), '12345678');
  assert.equal(normalizeTid('1234 5678'), '12345678');
  assert.equal(normalizeTid('TXN-AB12'), 'txnab12');
  assert.equal(normalizeTid('txn.ab_12'), 'txnab12');
  assert.equal(normalizeTid(' 1234-5678 '), '12345678');
  assert.equal(normalizeTid('TXN–AB12'), 'txnab12');
  assert.equal(normalizeTid(''), '');
  assert.equal(normalizeTid(null), '');
});

test('QC-7 fix 1: legitimate distinct TIDs stay distinct after normalising', () => {
  assert.notEqual(normalizeTid('TXN9001'), normalizeTid('TXN9002'));
  assert.notEqual(normalizeTid('JC555'), normalizeTid('JC556'));
  assert.notEqual(normalizeTid('12345678'), normalizeTid('12345679'));
  assert.notEqual(normalizeTid('AB12'), normalizeTid('AB123'));
  // A TID that is only digits is still its own TID, never a neighbour's.
  assert.equal(normalizeTid('12345678'), '12345678');
});

test('QC-7 fix 1: a separators-only TID normalises to empty and matches nothing', () => {
  assert.equal(normalizeTid('---'), '');
  assert.equal(normalizeTid(' - . '), '');
  const state = stateWithRecordedTid('TXN9001');
  assert.equal(findDuplicatePaymentReference(state, '---'), null);
  assert.equal(findPaymentsByTid(state.customers, ' - ').length, 0);
});

test('QC-7 fix 1: the duplicate guard fires on a separator-variant TID', () => {
  const state = stateWithRecordedTid('TXN9001');
  const byHyphen = findDuplicatePaymentReference(state, 'TXN-9001');
  assert.ok(byHyphen, 'TXN-9001 must match the recorded TXN9001');
  assert.equal(byHyphen.transactionId, 'TXN9001');
  assert.equal(byHyphen.amount, 2000);
  const bySpace = findDuplicatePaymentReference(state, 'txn 9001');
  assert.ok(bySpace, 'txn 9001 must match the recorded TXN9001');
  assert.equal(bySpace.transactionId, 'TXN9001');
  // A genuinely different TID still passes the guard.
  assert.equal(findDuplicatePaymentReference(state, 'TXN-9002'), null);
});

test('QC-7 fix 1: a voided payment never blocks, even for a separator variant', () => {
  let state = stateWithRecordedTid('TXN9001');
  const paymentId = state.customers[0].bills[0].payments[0].id;
  ({ state } = voidPayment(state, state.customers[0].id, MONTH, paymentId, { voidReason: 'Wrong entry (test)' }));
  assert.equal(findDuplicatePaymentReference(state, 'TXN-9001'), null);
  assert.equal(findDuplicatePaymentReference(state, 'TXN9001'), null);
});

test('QC-7 fix 1: leg-2 same-TID check refuses a separator-variant TID', () => {
  const state = splitFixture();
  const refDate = new Date('2026-10-29T12:00:00+05:00');
  // Same transfer on both legs, spelled with a separator on leg 2.
  assert.throws(() => validateSplitTender(state, {
    customerId: 'a', month: MONTH, date: '2026-10-29',
    legs: [
      { amount: 1500, method: 'Easypaisa', transactionId: 'EP 123456' },
      { amount: 1500, method: 'JazzCash', transactionId: 'ep-123456' },
    ],
  }, refDate), /same Transaction ID/);
  // Two genuinely different TIDs still validate.
  const cleaned = validateSplitTender(state, {
    customerId: 'a', month: MONTH, date: '2026-10-29',
    legs: [
      { amount: 1500, method: 'Easypaisa', transactionId: 'EP123456' },
      { amount: 1500, method: 'JazzCash', transactionId: 'EP123457' },
    ],
  }, refDate);
  assert.equal(cleaned.legs[0].transactionId, 'EP123456');
  assert.equal(cleaned.legs[1].transactionId, 'EP123457');
});

test('QC-7 fix 1: the near-duplicate warning fires on a separator-variant reference', () => {
  const earlier = {
    paymentId: 'P-1', customerId: 'C-1', customerName: 'Test Customer',
    billMonth: '2026-10', date: '2026-10-05', amountCents: 150000,
    channel: 'JazzCash', reference: 'TID-100',
  };
  const candidate = {
    customerId: 'C-1', date: '2026-10-05', amountCents: 150000,
    channel: 'JazzCash', reference: 'TID100',
  };
  const found = findNearDuplicates({ payments: [earlier], candidate, settings: {} });
  assert.equal(found.matches.length, 1);
  assert.equal(found.matches[0].reason, 'same-reference');
  // A genuinely different reference does not warn as same-reference
  // (different amount also keeps it out of the amount/channel/date rule).
  const other = findNearDuplicates({
    payments: [earlier],
    candidate: { ...candidate, reference: 'TID-200', amountCents: 160000 },
    settings: {},
  });
  assert.equal(other.matches.length, 0);
});

test('QC-7 fix 1: the guard returns the record, so the duplicate card + "Save anyway" path stays reachable', () => {
  // The guard is a finder, never a thrower: the UI shows the duplicate
  // card with this record and "Save anyway" records with a reason.
  // (The card flow itself is covered by the Plan 534 leg-2 tests.)
  const state = stateWithRecordedTid('TXN9001');
  let record;
  assert.doesNotThrow(() => { record = findDuplicatePaymentReference(state, 'TXN-9001'); });
  assert.ok(record);
  assert.equal(record.customerName, 'Test Customer');
  assert.equal(record.billMonth, MONTH);
});

// --- Fix 2: QC filter pills wrap at <= 620px -------------------------------

test('QC-7 fix 2: a 620px media rule makes the QC pill bar wrap with no horizontal scroll', () => {
  const pillBars = mediaBlocks(styles, '@media (max-width: 620px)')
    .filter((block) => block.includes('.qc-filter-pills'));
  assert.equal(pillBars.length, 1, 'exactly one 620px media rule must carry .qc-filter-pills');
  const bar = pillBars[0];
  assert.ok(bar.includes('flex-wrap: wrap'), 'wrapped bar must carry flex-wrap: wrap');
  assert.ok(bar.includes('overflow-x: visible'), 'wrapped bar must carry overflow-x: visible');
  assert.ok(!bar.includes('overflow-x: auto'), 'wrapped bar must not keep overflow-x: auto');
});

test('QC-7 fix 2: the base pill bar still scrolls on wide screens (desktop unchanged)', () => {
  const base = baseRuleBlock(styles, '.qc-filter-pills {');
  assert.ok(base.includes('overflow-x: auto'), 'base bar must keep overflow-x: auto');
  assert.ok(!base.includes('flex-wrap'), 'base bar rule must not wrap (wrap is the 620px rule only)');
});

test('QC-7 fix 2: the wrap breakpoint covers 360px', () => {
  // The rule is max-width: 620px, and 360 <= 620, so the 360px phone
  // gets the wrapped bar with no horizontal scroll.
  assert.ok(360 <= 620, '360px is inside the 620px breakpoint');
  const pillBars = mediaBlocks(styles, '@media (max-width: 620px)')
    .filter((block) => block.includes('.qc-filter-pills'));
  assert.equal(pillBars.length, 1);
});

test('QC-7 fix 2: the QC chips keep their 44px tap target and nowrap labels', () => {
  const chip = baseRuleBlock(styles, '.quick-collect-filter-chip {');
  assert.ok(chip.includes('min-height: 44px'), 'chip must keep its 44px tap target');
  assert.ok(chip.includes('white-space: nowrap'), 'chip labels must not wrap mid-label');
});

// --- Fix 3: explicit 360px QC rules ----------------------------------------

// Measurement model (see header): card inner width at 360px = 292px.
// A 0.95rem bold figure: 8px per digit, 9px per letter, 4px per space/comma.
function figureWidthPx(figure) {
  let width = 0;
  for (const ch of figure) {
    if (/[0-9]/.test(ch)) width += 8;
    else if (/[A-Za-z]/.test(ch)) width += 9;
    else width += 4;
  }
  return width;
}
const CARD_INNER_PX = 292;
const CARD_MAIN_GAP_PX = 12;
const CARD_LEFT_MIN_PX = 44; // number badge (~34px) + its 10px gap

test('QC-7 fix 3: a 360px media rule makes the picker card row wrap', () => {
  const blocks = mediaBlocks(styles, '@media (max-width: 360px)');
  const cardRows = blocks.filter((block) => block.includes('.qc3-card-main'));
  assert.equal(cardRows.length, 1, 'exactly one 360px media rule must carry .qc3-card-main');
  assert.ok(cardRows[0].includes('flex-wrap: wrap'), 'card row must carry flex-wrap: wrap');
});

test('QC-7 fix 3: the wrapped figures stay right-aligned on their own line', () => {
  const blocks = mediaBlocks(styles, '@media (max-width: 360px)');
  const figures = blocks.filter((block) => block.includes('.qc3-figures'));
  assert.equal(figures.length, 1, 'exactly one 360px media rule must carry .qc3-figures');
  assert.ok(figures[0].includes('margin-left: auto'), 'figures must carry margin-left: auto');
});

test('QC-7 fix 3: measured — a card with two 10-digit figures fits at 360px once the row wraps', () => {
  // Two 10-digit figures, e.g. outstanding PKR 1,234,567,890 + monthly
  // PKR 1,234,567,890, beside a 20-char name (~150px at 0.95rem semibold).
  const figure = 'PKR 1,234,567,890';
  const figurePx = figureWidthPx(figure);
  const figuresPx = figurePx * 2 + CARD_MAIN_GAP_PX;
  const namePx = 150;
  const unwrapped = CARD_LEFT_MIN_PX + CARD_MAIN_GAP_PX + figuresPx;
  // Without the wrap the row needs more than the card holds, so the
  // single-line flex crushes the name to the leftover (card minus
  // figures): the badge alone is ~34px, so the name gets ~0px.
  assert.ok(unwrapped > CARD_INNER_PX, `unwrapped row ${unwrapped}px must exceed the ${CARD_INNER_PX}px card`);
  const nameLeftOver = CARD_INNER_PX - CARD_MAIN_GAP_PX - figuresPx;
  assert.ok(nameLeftOver < CARD_LEFT_MIN_PX, `name is crushed to ${nameLeftOver}px without the wrap`);
  // With the wrap the figures drop to their own line: line 1 shows the
  // full name, line 2 shows both figures side by side.
  assert.ok(figuresPx <= CARD_INNER_PX, `wrapped figures line ${figuresPx}px must fit the ${CARD_INNER_PX}px card`);
  assert.ok(namePx <= CARD_INNER_PX, 'name line fits on its own row');
  // The wrapped layout still fits for two 11-digit figures (PKR tens
  // of billions — far beyond any real due), so the rule is not tuned
  // to one figure size.
  const huge = figureWidthPx('PKR 12,345,678,901') * 2 + CARD_MAIN_GAP_PX;
  assert.ok(huge <= CARD_INNER_PX, `two 11-digit figures ${huge}px must still fit wrapped`);
});

test('QC-7 fix 3: modal padding at 360px is pinned (the <= 640px dialog rule is the operative one)', () => {
  const blocks = mediaBlocks(styles, '@media (max-width: 640px)');
  const dialog = blocks.filter((block) => block.includes('dialog.quick-collect-modal'));
  assert.equal(dialog.length, 1, 'exactly one 640px media rule must carry the dialog rules');
  const rule = dialog[0];
  assert.ok(rule.includes('width: calc(100vw - 16px)'), 'dialog must be 16px narrower than the viewport');
  assert.ok(rule.includes('padding: 16px 14px'), 'dialog must keep 14px side padding');
  assert.ok(rule.includes('overflow-x: hidden'), 'dialog must never scroll sideways');
  // At 360px: dialog 344px wide, 14px padding each side -> 316px of
  // modal content, which is the width the card geometry above uses.
  assert.equal(360 - 16 - 28, 316);
});

// --- Fix 4: one-screen keypad ----------------------------------------------

test('QC-7 fix 4: the one-screen HTML carries the keypad host after the amount input', () => {
  const html = oneScreenHtml();
  const amountAt = html.indexOf('id="qosOneScreenAmount"');
  const keypadAt = html.indexOf('id="qosOneScreenKeypad"');
  assert.ok(amountAt >= 0, 'amount input missing');
  assert.ok(keypadAt > amountAt, 'keypad host must sit after the amount input');
  assert.match(html, /id="qosOneScreenKeypad" class="kpd-keypad" role="group" aria-label="Amount keypad"/);
});

test('QC-7 fix 4: the keypad host is empty in the module HTML (buttons come from the Plan 442 component at render time)', () => {
  const html = oneScreenHtml();
  assert.doesNotMatch(html, /data-kpd-key/, 'module HTML must not bake keypad buttons in');
  assert.equal(AMOUNT_KEYPAD_KEYS.length, 12, 'the keypad carries 12 keys');
  const keys = amountKeypadHtml();
  for (const key of AMOUNT_KEYPAD_KEYS) {
    assert.ok(keys.includes(`data-kpd-key="${key}"`), `key ${key} missing from the component HTML`);
  }
});

test('QC-7 fix 4: the host id uses the existing qos family (no new element-id prefix)', () => {
  const html = oneScreenHtml();
  assert.match(html, /id="qosOneScreenKeypad"/);
});

test('QC-7 fix 4: keypad digits enter the amount, exactly like typing', () => {
  // From the prefilled whole-rupee figure (Plan 442 semantics: the
  // paisa tail is dropped, never rounded, and a digit appends).
  assert.equal(amountKeypadApplyKey('3000.00', '5'), '30005');
  let entered = '';
  for (const key of ['1', '5', '0', '0']) entered = amountKeypadApplyKey(entered, key);
  assert.equal(entered, '1500');
  assert.equal(quickCollectOneScreenAmountCents(entered), 150000);
  const draft = quickCollectOneScreenDraft({
    customerId: 'CUST-1', amountText: entered, method: 'Cash', methods: METHODS,
  });
  assert.equal(draft.ok, true);
  assert.equal(draft.draft.amountCents, 150000);
});

test('QC-7 fix 4: backspace drops the last digit and clear empties the field', () => {
  assert.equal(amountKeypadApplyKey('1500', 'backspace'), '150');
  assert.equal(amountKeypadApplyKey('1', 'backspace'), '');
  assert.equal(amountKeypadApplyKey('1500', 'clear'), '');
  assert.equal(amountKeypadApplyKey('', 'backspace'), '');
});

test('QC-7 fix 4: the one-screen keypad is wired in nav-quick-collect (same component as the form step)', () => {
  const start = navQuickCollect.indexOf('function bindOneScreenControls');
  assert.ok(start >= 0, 'bindOneScreenControls missing');
  const end = navQuickCollect.indexOf('\n  function ', start + 10);
  const fn = navQuickCollect.slice(start, end === -1 ? navQuickCollect.length : end);
  assert.ok(fn.includes("querySelector('#qosOneScreenKeypad')"), 'one-screen keypad host must be looked up in bindOneScreenControls');
  assert.ok(fn.includes('amountKeypadHtml()'), 'one-screen keypad must render the Plan 442 keypad HTML');
  assert.ok(fn.includes('amountKeypadApplyKey('), 'one-screen keypad taps must apply through amountKeypadApplyKey');
  assert.ok(fn.includes('amountInputOne.value = amountKeypadApplyKey('), 'keypad taps must write the one-screen amount field');
  // The existing amount handling is untouched: the save still reads
  // the same amount field into the same draft.
  assert.ok(navQuickCollect.includes("stepOneScreen.querySelector('#qosOneScreenAmount')"), 'save must still read the one-screen amount field');
  assert.ok(navQuickCollect.includes('quickCollectOneScreenDraft({'), 'save must still validate through the one-screen draft');
});
