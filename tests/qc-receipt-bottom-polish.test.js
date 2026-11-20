// QC Receipt Bottom polish — user-told CSS polish, 2026-11-19.
//
// Four spec items (items 1, 2, 4 real; item 3's premise wrong — "Empty
// amount" is a genuinely different action, so it is restyled, not removed):
//  1. The Urdu support box split the WhatsApp icon from the number (the
//     span was a full-width flex row pushing the icon to the far end).
//     The wa.me link itself is now the inline-flex container (icon +
//     local number, dir=ltr, gap 6px) on its own <p> below the label;
//     the tel:+ link stays beside it. One fix repairs BOTH cards
//     (single + split-tender share receiptTermsNoteHtml).
//  2. The output/next labels wrapped at 360px. EN + UR values are
//     shortened together (Thermal Print / + Same Customer /
//     Next Customer ->) and .qc-action-label carries white-space: nowrap.
//  3. "Empty amount" read as a stray underlined link. It is a full
//     secondary-button (44px) now; its handler is untouched (same
//     customer, empty amount — genuinely distinct from Next Customer).
//  4. The header badge showed the SHORT form (RCPT-1) while the WhatsApp
//     preview shows the FULL stored number. QC receipt numbering
//     (2026-11-20) reverses that reversal: the number now lives in its
//     own pill row below the header, in the amount-pill style, as the
//     one global sequence (1, 2, 3, ...) — the same number the
//     WhatsApp draft carries. The header keeps only the shared badge.
//     The stored RCPT-/REC- numbers are unchanged; a receipt recorded
//     before the feature (no sequence) falls back to its stored number
//     in the pill row and the draft. Split legs show their own
//     sequences, falling back to the short form when they have none.
//
// This file pins NO parity total and asserts NO parity (602 pattern):
// it must contain neither the current-total bare digits nor the
// previous-total bare digits (plan591 G5a sweep — see the self-guard,
// which builds them from split literals so this file never carries them).
// Pattern-fake data only: Test Customer, RCPT-83-202611-01, 03012345678.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { receiptTermsNoteHtml } from '../receipt-terms.js';
import { shortReceiptNumber } from '../receipt.js';
import { receiptShareDraftFor } from '../receipt-share-draft.js';
import { TRANSLATIONS } from '../nav-language.js';
import { renderQuickCollectReceiptCardHtml } from '../nav-quick-collect.js';
import { renderSplitReceiptCardHtml } from '../split-tender-collect.js';

const dir = dirname(fileURLToPath(import.meta.url));
const read = (name) => readFileSync(join(dir, '..', name), 'utf8');
const styles = read('styles.css');
const indexSrc = read('index.html');
const qcJs = read('nav-quick-collect.js');
const { en, ur } = TRANSLATIONS;

// DM Sans 600 @12px per-char advances (px) — same model as the repro;
// Noto Nastaliq Urdu @12px is estimated at 1.5x the Latin per-char figure.
const ADV = {
  A: 7.9, B: 7.6, C: 7.6, D: 8.0, E: 7.0, F: 6.6, G: 8.0, H: 8.0, I: 3.4,
  J: 6.2, K: 7.6, L: 6.4, M: 9.4, N: 8.4, O: 8.2, P: 7.4, Q: 8.2, R: 7.6,
  S: 7.2, T: 7.0, U: 8.0, V: 7.6, W: 10.6, X: 7.4, Y: 7.2, Z: 7.0,
  a: 6.6, b: 6.8, c: 6.0, d: 6.8, e: 6.4, f: 3.8, g: 6.8, h: 6.8, i: 3.0,
  j: 3.2, k: 6.6, l: 3.0, m: 10.0, n: 6.8, o: 6.8, p: 6.8, q: 6.8, r: 4.2,
  s: 6.0, t: 3.8, u: 6.8, v: 6.4, w: 9.2, x: 6.4, y: 6.4, z: 6.0,
  ' ': 3.4, '0': 6.8, '1': 6.8, '2': 6.8, '3': 6.8, '4': 6.8, '5': 6.8,
  '6': 6.8, '7': 6.8, '8': 6.8, '9': 6.8, '+': 7.0, '→': 9.0, '/': 4.0,
  '(': 4.0, ')': 4.0, '-': 4.0, '·': 4.0,
};
const latinWidth = (s) => [...s].reduce((t, ch) => t + (ADV[ch] ?? 6.4), 0);
const nastaliqWidth = (s) => [...s].length * 6.4 * 1.5;
const COL3_BUDGET = 82.7;
const COL2_BUDGET = 133;

// Generic fixture only — pattern-fake phone, no real customer data.
function baseReceipt(overrides = {}) {
  return {
    id: 'receipt-83', receiptNumber: 'RCPT-83-202611-01', amount: 800,
    customerId: 'cust-83', customerName: 'Test Customer', customerNumber: 83,
    date: '2026-11-19', month: '2026-11', method: 'Cash', area: 'Nakar',
    payableRemaining: 0, newTotalDues: 0, phone: '',
    ...overrides,
  };
}
function baseSplit(overrides = {}) {
  return {
    customerName: 'Test Customer', customerNumber: 83, area: 'Nakar',
    totalReceived: 800, balanceDueCents: 0, payableRemainingCents: 0,
    legs: [
      { leg: 1, method: 'Cash', amount: 800, receiptNumber: 'RCPT-83-202611-01' },
    ],
    ...overrides,
  };
}

const supportHtml = receiptTermsNoteHtml({ contactActions: true });
const cardHtml = renderQuickCollectReceiptCardHtml(baseReceipt());

// --- C1: one wa.me link carries icon + number, on its own line ---
test('C1 support box: ONE wa.me link carries the WhatsApp icon + the local number', () => {
  const waLink = supportHtml.match(/<a[^>]*href="https:\/\/wa\.me\/(\d+)"[^>]*>([\s\S]*?)<\/a>/);
  assert.ok(waLink, 'a wa.me link must exist');
  assert.ok(/<svg/.test(waLink[2]), 'the link must carry the WhatsApp icon');
  assert.ok(waLink[2].includes('03415277081'), 'the link must carry the local number');
  assert.ok(/receipt-support-contact/.test(waLink[0]), 'the link itself must be the contact container');
  assert.ok(/dir="ltr"/.test(waLink[0]), 'the link must be dir=ltr');
});

test('C1 support box: inline-flex + gap + ltr rule, own line below the label, tel:+ kept', () => {
  assert.ok(/\.receipt-support-contact\s*\{[^}]*display:\s*inline-flex[^}]*gap:\s*6px[^}]*direction:\s*ltr/.test(styles),
    'the contact rule must be inline-flex + gap 6px + direction ltr');
  const labelAt = supportHtml.indexOf('ٹیکنیکل سپورٹ');
  const rowAt = supportHtml.indexOf('wa.me');
  assert.ok(labelAt >= 0 && rowAt > labelAt && supportHtml.slice(labelAt, rowAt).includes('</p>'),
    'the contact row must sit on its own <p> below the Urdu label');
  assert.ok(supportHtml.includes('tel:+923415277081'), 'the tel:+ call link must stay');
  assert.ok(!/\.receipt-support-whatsapp\s*\{[^}]*margin-inline-start:\s*auto/.test(styles),
    'the old rule pushing the icon to the far end must be gone');
});

// --- C2: shortened labels fit single-line in both languages ---
test('C2 output labels: short EN + UR values fit the 3-col budget', () => {
  assert.equal(en.qc_bt_print, 'Thermal Print', 'EN BT label must be shortened');
  assert.ok(latinWidth(en.qc_bt_print) <= COL3_BUDGET, `'Thermal Print' ~${latinWidth(en.qc_bt_print).toFixed(1)}px must fit ${COL3_BUDGET}px`);
  assert.ok(nastaliqWidth(ur.qc_bt_print) <= COL3_BUDGET, `UR BT label ~${nastaliqWidth(ur.qc_bt_print).toFixed(1)}px must fit ${COL3_BUDGET}px`);
  assert.ok(['qc_share_image', 'qc_print_slip', 'qc_bt_print'].every((k) => latinWidth(en[k]) <= COL3_BUDGET),
    'all three 3-col EN labels must fit');
  assert.ok(/\.qc-action-label\s*\{[^}]*white-space:\s*nowrap/.test(styles),
    '.qc-action-label must carry white-space: nowrap');
});

test('C2 next labels: short EN + UR values fit the 2-col budget, no "(+" orphan', () => {
  assert.equal(en.qc_same_customer, '+ Same Customer', 'EN same-customer label must be shortened');
  assert.equal(en.qc_next_customer, 'Next Customer →', 'EN next-customer label must be shortened');
  assert.ok(latinWidth(en.qc_same_customer) <= COL2_BUDGET && latinWidth(en.qc_next_customer) <= COL2_BUDGET,
    'both 2-col EN labels must fit single-line');
  assert.ok(nastaliqWidth(ur.qc_same_customer) <= COL2_BUDGET && nastaliqWidth(ur.qc_next_customer) <= COL2_BUDGET,
    'both 2-col UR labels must fit single-line (Nastaliq estimate)');
  assert.ok(!en.qc_same_customer.includes('(+') && !ur.qc_same_customer.includes('(+'),
    'the old "(+ Payment" orphan must be gone from both dicts');
});

// --- C3: Empty amount is a real secondary button with its own handler ---
test('C3 Empty amount: distinct handler + secondary-button treatment', () => {
  assert.ok(/openCustomerCollectionForm\(activeCustomerId, \{ emptyAmount: true \}\)/.test(qcJs),
    'Empty amount must keep its own handler (same customer, empty amount)');
  const btn = indexSrc.match(/<button[^>]*data-qc-empty-amount[^>]*>/);
  assert.ok(btn && /secondary-button/.test(btn[0]), 'Empty amount must carry the secondary-button class');
  const at = styles.indexOf('.qc-empty-amount-btn');
  assert.ok(at >= 0, 'the empty-amount rule must exist');
  const block = styles.slice(styles.indexOf('{', at), styles.indexOf('}', at));
  assert.ok(!/text-decoration:\s*underline/.test(block), 'Empty amount must no longer be underlined');
  assert.ok(!/min-height:\s*24px/.test(block), 'Empty amount must no longer be a 24px text button');
  const order = [indexSrc.indexOf('data-qc-same-customer'), indexSrc.indexOf('data-qc-next-customer'), indexSrc.indexOf('data-qc-empty-amount')];
  assert.ok(order[0] > 0 && order[1] > order[0] && order[2] > order[1], 'action order must stay same, then next, then empty');
});

// --- C4: pill row shows the global sequence, same as the draft ---
test('C4 pill row shows the global sequence, identical to the WhatsApp draft', () => {
  const sequenced = renderQuickCollectReceiptCardHtml({ ...baseReceipt(), receiptSequence: 83 });
  assert.ok(sequenced.includes('>83<'), 'pill row must read the global sequence');
  assert.ok(!sequenced.includes('>RCPT-83-202611-01<'), 'the long stored number must not be the visible card text');
  const draft = receiptShareDraftFor({ ...baseReceipt(), receiptSequence: 83 }, 'share text');
  assert.ok(draft && draft.receiptNumber === '83', 'the draft must carry the same sequence');
  const legacy = receiptShareDraftFor(baseReceipt(), 'share text');
  assert.ok(legacy && legacy.receiptNumber === 'RCPT-83-202611-01', 'a receipt without a sequence keeps the stored number in the draft');
  assert.ok(!cardHtml.includes('data-full-receipt-number'), 'the header ref chip is gone');
});

// --- Steady state ---
test('S1 parity EN==UR (value-agnostic, no total pinned)', () => {
  assert.equal(Object.keys(TRANSLATIONS.en).length, Object.keys(TRANSLATIONS.ur).length,
    'EN and UR dicts must stay equal in size');
});

test('S2 shortReceiptNumber unchanged + split legs still short', () => {
  assert.equal(shortReceiptNumber('RCPT-12-202611-03'), 'RCPT-3', 'the helper must stay');
  const split = renderSplitReceiptCardHtml(baseSplit());
  assert.ok(split.includes('RCPT-1'), 'split legs must still show the short form');
  assert.ok(!split.includes('RCPT-83-202611-01'), 'split legs must not show the full stored number');
});

test('S3 both contact links + local form on the card; both cards carry them', () => {
  assert.ok(cardHtml.includes('wa.me/') && cardHtml.includes('tel:+'), 'single card must carry both links');
  assert.ok(cardHtml.includes('03415277081'), 'single card must show the local form');
  const split = renderSplitReceiptCardHtml(baseSplit());
  assert.ok(split.includes('wa.me/') && split.includes('tel:+'), 'split card must carry both links');
  assert.ok(split.includes('03415277081'), 'split card must show the local form');
});

test('S4 the 8 qc_* action keys still exist in both dicts', () => {
  const keys = ['qc_same_customer', 'qc_next_customer', 'qc_empty_amount', 'qc_share_image', 'qc_print_slip', 'qc_bt_print', 'qc_toast_draft_copied', 'qc_toast_draft_copy_failed'];
  assert.ok(keys.every((k) => k in en && k in ur), 'key names must not move');
});

// --- Self-guard: this file pins no parity total ---
test('G self-guard — this file carries neither the current nor the previous parity bare digits', () => {
  // The digits are built from split literals so this file itself never
  // contains them (plan591 G5a sweeps the whole tests/ tree for the bare
  // digits of the previous total). This file asserts no parity total.
  const selfSrc = read('tests/qc-receipt-bottom-polish.test.js');
  assert.ok(!selfSrc.includes('51' + '61'), 'this file must not carry the current parity bare digits');
  assert.ok(!selfSrc.includes('51' + '45'), 'this file must not carry the previous parity bare digits');
});
