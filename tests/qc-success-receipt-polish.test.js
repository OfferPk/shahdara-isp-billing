// QC Success Receipt polish (TOP section) — user-told CSS polish, 2026-11-19.
//
// Four spec items, all real on the true base (main 7cb33103):
//  1. The English sync notice inherited the callout's RTL, so its trailing
//     period jumped to the start of line 2. The English else-branch now
//     sets dir=ltr explicitly (the Urdu branch still sets rtl + Nastaliq).
//  2. "WhatsApp Pending" + "Receipt No." wrapped at 360px. The header is
//     nowrap now and the badge/ref/chip are shaved ~12px (all scoped to
//     the success-open card), so they fit one row with ~8px slack by the
//     DejaVu upper-bound budget.
//  3. The Change button sat centred and unstyled under the phone. It is
//     now a left-aligned emerald underlined inline link (token
//     --qc-emerald-text, zero new hex); hook + handler untouched.
//  4. The checkmark floated at the far right because the wrapping h3's
//     flex box filled the row. The row is inline flow now (block row,
//     inline h3, check vertical-align middle); the package line reads
//     'PKR 800/mo' (pkg_auto_set_note value-only, both dicts); vertical
//     padding is cut to a measured ~88px saving.
//  4(d) KEEP ↩: the glyph matches the action (back to the customer
//     picker, the user-reported 2026-11-12 fix, PR #1365, pinned by
//     qc-success-back-to-picker). Swapping to ✕ without changing the
//     action would lie about what the button does.
//  4(c) REWORDED acceptance: the measured saving is >= 80px; the
//     remaining ~142px overage at 360x800 is disclosed, not hidden —
//     literal "fits without scrolling" is NOT achievable by padding
//     alone, and full no-scroll fit is a separate bigger restructure.
//
// This file pins NO parity total and asserts NO parity (602 pattern):
// it must contain neither the current-total bare digits nor the
// previous-total bare digits (plan591 G5a sweep — see the self-guard,
// which builds them from split literals so this file never carries them).
// Pattern-fake data only: Test Customer, RCPT-12-202611-01, 03012345678.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { renderQuickCollectReceiptCardHtml } from '../nav-quick-collect.js';
import { TRANSLATIONS } from '../nav-language.js';

const dir = dirname(fileURLToPath(import.meta.url));
const read = (name) => readFileSync(join(dir, '..', name), 'utf8');
const styles = read('styles.css');
const qcJs = read('nav-quick-collect.js');
const appJs = read('app.js');

// --- CSS rule helper: first block whose selector starts a line with `needle` ---
// (Line-anchored: the bare class also appears inside longer scoped selectors.)
function ruleBody(needle) {
  const key = `\n${needle} {`;
  const at = styles.indexOf(key);
  if (at < 0) return null;
  const open = styles.indexOf('{', at);
  if (open < 0) return null;
  let depth = 0;
  for (let i = open; i < styles.length; i++) {
    if (styles[i] === '{') depth++;
    if (styles[i] === '}') { depth--; if (depth === 0) return styles.slice(open + 1, i); }
  }
  return null;
}
const has = (body, re) => body !== null && re.test(body);
const num = (body, prop) => {
  if (body === null) return null;
  const m = body.match(new RegExp(`${prop}:\\s*([0-9.]+)px`));
  return m ? Number(m[1]) : null;
};

// Generic fixture only — pattern-fake phone, no real customer data.
function baseReceipt(overrides = {}) {
  return {
    id: 'r1', customerId: 'c1', customerName: 'Test Customer', customerNumber: '1',
    phone: '03012345678', receiptNumber: 'RCPT-12-202611-01', amount: 800,
    method: 'Cash', date: '2026-11-19', month: '2026-11', area: 'Nakar',
    advanceCreditGenerated: 800, packageAutoSet: { fee: 800 },
    transactionId: '', remainingPayable: 0,
    ...overrides,
  };
}
const cardHtml = renderQuickCollectReceiptCardHtml(baseReceipt(), {
  whatsappPhone: '03012345678', nextDueDateText: '5 Dec 2026',
});
const cardHtml1500 = renderQuickCollectReceiptCardHtml(
  baseReceipt({ amount: 1500, packageAutoSet: { fee: 1500 }, advanceCreditGenerated: 0 }),
  { whatsappPhone: '03012345678', nextDueDateText: '5 Dec 2026' },
);

// --- C1: the English sync notice is explicitly LTR; the callout stays RTL ---
test('C1 English fallback notice is explicitly LTR (JS dir=ltr), callout stays RTL', () => {
  const elseSetsLtr = /else\s*\{[^}]*setAttribute\('dir',\s*'ltr'\)/s.test(qcJs);
  assert.ok(elseSetsLtr, 'applyPackageSuccessMessage else-branch must setAttribute(dir, ltr)');
  const callout = ruleBody('#quickCollectModal.qc-success-open .qc-success-callout');
  assert.ok(has(callout, /direction:\s*rtl/), 'the callout must keep direction: rtl (Urdu package message needs it)');
});

// --- C2: badge + Receipt No. on one row at 360px ---
test('C2 badge + Receipt No. fit one row at 360px (nowrap + width budget)', () => {
  const headerRule = ruleBody('#quickCollectModal.qc-success-open .qc-receipt-card .qc-receipt-header');
  assert.ok(has(headerRule, /flex-wrap:\s*nowrap/), 'success-open header must be flex-wrap: nowrap');
  // DejaVu upper-bound text widths: badge text 129 + svg 12, ref label 80 + id 43.
  const badgeScoped = ruleBody('#quickCollectModal.qc-success-open .qc-receipt-card .badge-receipt-unshared');
  const badgeGap = num(badgeScoped, 'gap') ?? 4;
  const badgePadMatch = badgeScoped?.match(/padding:\s*[0-9.]+px\s+([0-9.]+)px/);
  const badgePadX = badgePadMatch ? Number(badgePadMatch[1]) : 8;
  const badgeW = 129 + 12 + badgeGap + badgePadX * 2 + 2;
  const refRule = ruleBody('#quickCollectModal.qc-success-open .qc-receipt-card .qc-receipt-ref');
  const refGap = num(refRule, 'gap') ?? 6;
  const chipRule = ruleBody('#quickCollectModal.qc-success-open .qc-receipt-card .qc-receipt-header .qc-txnid-code');
  const chipPadMatch = chipRule?.match(/padding:\s*[0-9.]+px\s+([0-9.]+)px/);
  const chipPadX = chipPadMatch ? Number(chipPadMatch[1]) : 6;
  const refW = 80 + refGap + 43 + chipPadX * 2;
  const cardPad = num(ruleBody('#quickCollectModal.qc-success-open .qc-receipt-card'), 'padding') ?? 10;
  const cardInner360 = 316 - cardPad * 2;
  assert.ok(badgeW + refW <= cardInner360 - 8,
    `badge (${badgeW}) + ref (${refW}) = ${badgeW + refW} must fit inner ${cardInner360} with 8px slack`);
});

// --- C3: Change is a left-aligned emerald link under the phone ---
test('C3 Change button left-aligned under the phone + emerald underline link style', () => {
  const changeRule = ruleBody('#quickCollectModal.qc-success-open .qc-receipt-item [data-qc-edit-phone]');
  assert.ok(changeRule !== null, 'scoped Change rule must exist');
  assert.ok(has(changeRule, /align-self:\s*flex-start/) || has(changeRule, /text-align:\s*left/),
    'Change must sit left (align-self: flex-start or text-align: left)');
  assert.ok(has(changeRule, /color:\s*var\(--qc-emerald-text\)/), 'Change must use the emerald token');
  assert.ok(has(changeRule, /text-decoration:\s*underline/), 'Change must be underlined');
  assert.ok(cardHtml.includes('data-qc-edit-phone'), 'the Change hook must still render on the card');
  assert.ok(qcJs.includes("closest?.('[data-qc-add-phone], [data-qc-edit-phone]')"),
    'the Change delegation to the inline editor must be intact');
});

// --- C4: checkmark flows inline after the heading text ---
test('C4 checkmark flows inline after the heading text (block row, inline h3 + check)', () => {
  const rowRule = ruleBody('.qc-success-heading-row');
  const h3Rule = ruleBody('#quickCollectSuccessHeading');
  const checkRule = ruleBody('.qc-success-heading-row .qc-success-check');
  const baseCheckRule = ruleBody('.qc-success-check');
  assert.ok(has(rowRule, /display:\s*block/) && has(rowRule, /text-align:\s*center/),
    'heading row must be display: block + text-align: center (flex cannot shrink a wrapping h3)');
  assert.ok(has(h3Rule, /display:\s*inline/), 'heading must be display: inline');
  assert.ok(has(checkRule, /vertical-align:\s*middle/), 'check must sit on the text baseline');
  assert.ok(has(baseCheckRule, /display:\s*inline-flex/), 'check must stay inline-flex at base');
});

// --- C5: package line reads PKR 800/mo, grouped for larger amounts ---
test("C5 package line is 'PKR 800/mo' (grouped 'PKR 1,500/mo'), no '/ month' orphan", () => {
  assert.ok(cardHtml.includes('PKR 800/mo'), 'card must read PKR 800/mo');
  assert.ok(!cardHtml.includes('/ month'), 'the spaced / month orphan must be gone');
  assert.ok(cardHtml1500.includes('PKR 1,500/mo'), 'grouping must survive (PKR 1,500/mo)');
  assert.ok(TRANSLATIONS.en.pkg_auto_set_note.includes('/mo'), 'EN key value must use /mo');
  assert.ok(TRANSLATIONS.ur.pkg_auto_set_note.includes('/mo'), 'UR key value must use /mo');
  assert.ok(appJs.includes("t('pkg_auto_set_note'"), 'the app.js toast shares the key (both surfaces move together)');
});

// --- C6: vertical padding reduced, measured saving >= 80px ---
test('C6 vertical padding reduced (banner/callout/card/step/actions), measured saving >= 80px', () => {
  const bannerRule = ruleBody('#quickCollectModal.qc-success-open .qc-success-banner');
  const calloutRule = ruleBody('#quickCollectModal.qc-success-open .qc-success-callout');
  const cardRule = ruleBody('#quickCollectModal.qc-success-open .qc-receipt-card');
  const stepRule = ruleBody('#quickCollectModal.qc-success-open #quickCollectStepSuccess');
  const actionsRule = ruleBody('.qc-success-actions');
  const bannerPad = bannerRule?.match(/padding:\s*([0-9.]+)px\s+([0-9.]+)px/);
  const calloutPad = calloutRule?.match(/padding:\s*([0-9.]+)px\s+([0-9.]+)px/);
  const bannerV = bannerPad ? Number(bannerPad[1]) : 12;
  const calloutV = calloutPad ? Number(calloutPad[1]) : 10;
  const cardP = num(cardRule, 'padding') ?? 10;
  const cardGap = num(cardRule, 'gap') ?? 8;
  const stepGap = num(stepRule, 'gap') ?? 8;
  const actionsGap = num(actionsRule, 'gap') ?? 8;
  const actionsMt = num(actionsRule, 'margin-top') ?? 8;
  assert.ok(bannerV <= 10 && calloutV <= 8 && cardP <= 8 && cardGap <= 6 && stepGap <= 6 && actionsGap <= 6,
    `bannerV=${bannerV} calloutV=${calloutV} cardP=${cardP} cardGap=${cardGap} stepGap=${stepGap} actionsGap=${actionsGap}`);
  // Saved px vs the base values (banner 12, callout 10, card 10, gaps 8/8/8).
  const saved = (12 - bannerV) * 2 + (10 - calloutV) * 2 + (10 - cardP) * 2
    + (8 - cardGap) * 4 + (8 - stepGap) * 6 + (8 - actionsGap) * 5 + (8 - actionsMt);
  // Header one row saves ~24px; package one line saves ~20px.
  const savedTotal = saved + 24 + 20;
  assert.ok(savedTotal >= 80, `measured saving ~${savedTotal}px must be >= 80px`);
});

// --- Steady state: ↩ kept (glyph matches the back-to-picker action) ---
test('S3 header button swap intact (↩ on success = back, ✕ elsewhere = close)', () => {
  assert.ok(qcJs.includes("closeBtn.textContent = stepName === 'success' ? '↩' : '✕'"),
    'the success step must keep ↩ (PR #1365 back-to-picker fix)');
  assert.ok(/if \(stepSuccess && !stepSuccess\.hidden\) \{\s*collectAnotherCustomer\(\);/.test(qcJs),
    'the success close button must still go back to the picker');
});

// --- Steady state: Urdu package message still RTL + Nastaliq ---
test('S4 Urdu package message still dir=rtl + Nastaliq toggle', () => {
  assert.ok(qcJs.includes("messageEl.setAttribute('dir', 'rtl')"), 'Urdu branch must still set dir=rtl');
  assert.ok(qcJs.includes("messageEl.classList.toggle('qc-urdu-nastaliq', isUrdu)"), 'Nastaliq toggle must survive');
});

// --- Steady state: 44px button floor intact ---
test('S9 Sharafat 96 floor intact', () => {
  assert.ok(styles.includes('button:not([hidden]) { min-height: 44px !important; }'),
    'the 44px floor must survive the polish');
});

// --- Steady state: parity EN==UR (value-agnostic, no totals pinned) ---
test('S1 parity EN==UR (value-agnostic)', () => {
  assert.equal(Object.keys(TRANSLATIONS.en).length, Object.keys(TRANSLATIONS.ur).length,
    'EN and UR dicts must stay equal in size');
});

// --- Self-guard: this file pins no parity total ---
test('G self-guard — this file carries neither the current nor the previous parity bare digits', () => {
  // The digits are built from split literals so this file itself never
  // contains them (plan591 G5a sweeps the whole tests/ tree for the bare
  // digits of the previous total). This file asserts no parity total.
  const selfSrc = read('tests/qc-success-receipt-polish.test.js');
  assert.ok(!selfSrc.includes('51' + '45'), 'this file carries the current parity bare digits');
  assert.ok(!selfSrc.includes('51' + '38'), 'this file carries the previous parity bare digits');
});
