// QC Modal Fix (2026-11-13) — Quick Collect Cash modal UI/UX fix,
// from the user's running list (items 1–14), all in one PR.
//
// Stylesheet-value approach (polish #17/#21/#25/#27 pattern): read
// the HTML/CSS/JS as text and assert the values; no browser needed.
// Fixture data only — pattern-fake phones (0301234567n family), no
// real customer data of any kind in this file.
//
// Ratchet disclosure (in the PR body too): the user's palette is
// implemented as --qc-* tokens in tokens.css — the user's exact hex
// values live there, and styles.css uses only var(), so styles.css
// stays at 613 distinct hex and the ==613 pins stay green. No new
// hex enters any legacy stylesheet.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createInitialState, saveBillMonth, updateCustomerProfile } from '../core.js';
import { renderQuickCollectPickerHtml } from '../nav-quick-collect.js';
import { TRANSLATIONS } from '../nav-language.js';
import { quickCollectRoundTotalsText } from '../quick-collect-round-totals.js';
import { dailyTargetProgress, dailyTargetProgressText } from '../daily-target-progress.js';
import {
  quickCollectOneScreenComboboxChoices,
  quickCollectOneScreenComboboxFilter,
  quickCollectOneScreenComboboxOptionHtml,
  quickCollectOneScreenHtml,
  quickCollectOneScreenMethodPills,
  quickCollectOneScreenResolveMethod,
  quickCollectOneScreenSaveLabel,
  quickCollectOneScreenShopShortLabel,
} from '../quick-collect-one-screen.js';
import { oneScreenQuickAmountButtonsHtml } from '../one-screen-quick-amounts.js';
import { amountKeypadHtml } from '../quick-collect-amount-keypad.js';
import { QC2_HIGH_DUES_MIN_RUPEES, qc2HasHighBalance } from '../qc2-priority.js';
import { HELP_GOT_IT_ID } from '../help-guide.js';

const read = (name) => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const html = read('index.html');
const styles = read('styles.css');
const tokens = read('tokens.css');
const qcSrc = read('nav-quick-collect.js');

const METHODS = ['Cash', 'JazzCash', 'Easypaisa', 'NayaPay', 'Bank Transfer', 'Raast', 'Cash at Waseem Abbasi shop', 'Cash at Hassan shop', 'Cash at Balla shop', 'Cash at Hassan Balla shop'];

function distinctHex(source) {
  // The pinned ratchet method, verbatim (profile-polish-d.test.js):
  // comments stripped, 6- or 3-digit hex with a word boundary, case
  // preserved — a hex in both cases counts twice, by design.
  const stripped = source.replace(/\/\*[\s\S]*?\*\//g, '');
  return new Set(stripped.match(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g) || []);
}

// --- (1) One compact 1-line summary bar ------------------------------

test('(1) the round and Today texts are one short line each', () => {
  assert.equal(quickCollectRoundTotalsText({ count: 0, total: 0 }), 'Round: 0');
  assert.equal(quickCollectRoundTotalsText({ count: 3, total: 9000 }), 'Round: 3 · PKR 9,000');
  assert.equal(dailyTargetProgressText(dailyTargetProgress(12000, 50000)), 'Today: PKR 12,000 · 24%');
  assert.equal(dailyTargetProgressText(dailyTargetProgress(0, null)), 'Today: PKR 0');
});

test('(1) the banner lays the two lines out in one row, Today first', () => {
  assert.match(styles, /\.qc-round-banner\s*\{[^}]*display:\s*flex/, 'banner must be a flex row');
  assert.match(styles, /\.qc-round-banner \.dtp-line\s*\{[^}]*order:\s*1/, 'Today line must come first');
  assert.match(styles, /\.qc-round-banner \.rtt-round-totals\s*\{[^}]*order:\s*2/, 'Round line must come second');
  assert.match(styles, /\.qc-round-banner \.dtp-daily-target-progress\s*\{[^}]*display:\s*contents/, 'day-target host must not box the line');
  assert.match(styles, /\.qc-step\s*\{[^}]*margin-top:\s*12px/, 'picker step must clear the sticky heading');
  // QC True 1-Row Tightening (item A, spec §0.4 + parent decision
  // D-A8): the banner is a true 38px row — padding 2px (the spec's
  // 6px makes a 46px box) and all three cells at 0.8rem, so they
  // fit one 292px row (at 0.85rem they total 293.8px and the button
  // wraps to a second row). The harness measures the 38px box.
  assert.match(styles, /\.qc-round-banner\s*\{[^}]*padding:\s*2px 10px/, 'the banner must be a true 38px row at 2px padding');
  assert.match(styles, /\.qc-round-banner \.dtp-line\s*\{[^}]*font-size:\s*0\.8rem/, 'the Today line must be 0.8rem so the row fits');
  assert.match(styles, /\.qc-round-banner \.rtt-round-totals\s*\{[^}]*font-size:\s*0\.8rem/, 'the Round line must be 0.8rem so the row fits');
  assert.match(styles, /\.qc-round-banner \.eds-summary-button\s*\{[^}]*font-size:\s*0\.8rem/, 'the Day Summary button must be 0.8rem so the row fits');
});

// --- (2) Day Summary, no New customer, compact footer ----------------

test('(2) the picker shows a short Day Summary button and no New customer button', () => {
  // Quick Collect CSS tightening (user instruction 2026-11-13,
  // parent decision D4): the 📊 is gone — the button carries a
  // BarChart3 ds-icon + "Day Summary" text (BarChart2 does not
  // exist in ds-icons.js).
  assert.match(html, /id="edsEndOfDaySummaryButton"[^>]*>[\s\S]*?Day Summary\s*</, 'Day Summary label must be short');
  assert.ok(html.includes('data-ds-icon="BarChart3"'), 'Day Summary must carry a BarChart3 ds-icon');
  assert.equal(html.includes('📊 Day Summary'), false, 'the 📊 emoji must be gone from the Day Summary button');
  assert.equal(html.includes('id="ncaNewCustomerButton"'), false, '+ New customer must be gone from the middle of the modal');
  assert.equal(html.includes('＋ New customer'), false, 'no New customer label anywhere in the modal');
  assert.match(html, /id="quickCollectOpenOneScreenBtn"[^>]*class="[^"]*\bqc-footer-btn\b"[^>]*>\s*⚡ Quick Entry\s*</, 'footer must read Quick Entry');
  assert.match(html, /id="quickCollectGoToTransactionsBtn"[^>]*class="[^"]*\bqc-footer-btn\b"[^>]*>\s*📋 Full Ledger\s*</, 'footer must read Full Ledger');
  assert.equal(html.includes('One-screen payment — customer, amount, method, save'), false, 'old tall footer label must be gone');
  assert.equal(html.includes('Switch to Full Ledger &amp; Transactions Table'), false, 'old tall footer label must be gone');
});

// --- (3) Mohalla • Package Name subtitle -----------------------------

function subtitleState() {
  const now = new Date();
  let state = createInitialState(['Subtitle Tester']);
  state = updateCustomerProfile(state, state.customers[0].id, {
    mohalla: 'Chamyaa', packageSpeed: '3Mbps / 100GB', monthlySellingAmount: 1000,
  }, now);
  const month = new Date(now.getTime() + 5 * 3600 * 1000).toISOString().slice(0, 7);
  state = saveBillMonth(state, state.customers[0].id, { month, dueAmount: '1000', status: 'pending', dueDate: `${month}-05` }, now);
  return state;
}

test('(3) the card subtitle is Mohalla • Package Name, never the scorer reason', () => {
  const { html: pickerHtml } = renderQuickCollectPickerHtml(subtitleState(), '', 'all-dues');
  assert.ok(pickerHtml.includes('CHAMYAAA • 3Mbps / 100GB'), 'subtitle must read Mohalla • Package Name (mohalla in its stored form)');
  assert.equal(pickerHtml.includes('qc2-priority-reason'), false, 'no scorer reason under the name');
  assert.equal(pickerHtml.includes('Outstanding PKR 1,000 (+'), false, 'no truncated Outstanding line');
  // Quick Collect CSS tightening (user instruction 2026-11-13):
  // the priority badge left its top-right seat (.qc-card-right,
  // deleted from the picker render) for the chips row below the
  // identity + figures row — the seat itself is pinned by the
  // qc-cash-modal-overhaul badge test. This fixture has no scorer
  // row and dues below the High threshold, so its card renders no
  // chips row at all.
  assert.equal(pickerHtml.includes('qc-card-right'), false, 'the picker card must not render the top-right column anymore');
});

// --- (4) One compact action row --------------------------------------

test('(4) the card has one compact action row with plain Collect', () => {
  const { html: pickerHtml } = renderQuickCollectPickerHtml(subtitleState(), '', 'all-dues');
  assert.ok(pickerHtml.includes('qc3-action-btn--icon qc3-action-btn--call'), 'Call is a compact icon button');
  assert.ok(pickerHtml.includes('qc3-action-btn--icon qc3-action-btn--location'), 'Location is a compact icon button');
  // QC Modal Overhaul 2: Collect is plain "Collect" — the dues badge
  // ("PKR 1,000 DUE") already names the figure, so the button
  // naming it again was the second copy. The old "Collect PKR 1,000"
  // label is gone; the badge is the one place the figure appears.
  assert.equal(pickerHtml.includes('Collect PKR 1,000'), false, 'Collect must not repeat the amount the dues badge names');
  assert.ok(pickerHtml.includes('Collect</button>'), 'Collect must stay a plain label');
  assert.ok(pickerHtml.includes('PKR 1,000'), 'the dues figure must stay on the card, in the badge');
  // QC True 1-Row Tightening (item A): the modal's action row is
  // a GRID (auto auto 1fr) at 38px — Call / Map size to their
  // labels, Collect takes the rest. This REVERSES the QC
  // Tightening flex sizing (Call / Location flex 1, Collect flex
  // 1.5, 40px) and the QC Modal Fix item 6 wrap valve (36px icon
  // buttons, Collect flex 1 1 auto) — the harness must prove the
  // row at 360px AND 320px. The 36px / 1 1 auto base rules stay
  // for Field Mode.
  assert.match(styles, /#quickCollectModal \.qc3-card-actions\s*\{[^}]*display:\s*grid[^}]*grid-template-columns:\s*auto auto 1fr/, 'modal action row must be a grid — Call / Map size to their labels, Collect takes the rest');
  assert.match(styles, /#quickCollectModal \.qc3-action-btn--call,\s*#quickCollectModal \.qc3-action-btn--location\s*\{[^}]*min-height:\s*38px !important[^}]*height:\s*38px/, 'modal Call / Map buttons must be 38px');
  assert.match(styles, /#quickCollectModal \.qc3-collect\s*\{[^}]*min-height:\s*38px !important[^}]*height:\s*38px/, 'modal Collect must be 38px');
});

// --- (5) Priority badge matches the High filter ----------------------

test('(5) the High-dues threshold is one shared constant, and the tag reads it', () => {
  assert.equal(QC2_HIGH_DUES_MIN_RUPEES, 2000);
  assert.equal(qc2HasHighBalance(2000), true);
  assert.equal(qc2HasHighBalance(1999), false);
  assert.equal(qc2HasHighBalance(null), false);
  assert.equal(qc2HasHighBalance(''), false);
  assert.equal(qc2HasHighBalance(true), false);
  assert.ok(qcSrc.includes("totalDues < QC2_HIGH_DUES_MIN_RUPEES"), 'the filter must use the shared constant, not a literal');
  assert.ok(qcSrc.includes("qc2HasHighBalance(c.totalDues)"), 'the card tag must use the same helper');
  // QC True 1-Row Tightening (item A): the tag is shortened to
  // the bare threshold ('≥2k') so the chips row fits one line —
  // the 'High balance' words are gone from both dicts.
  assert.equal(TRANSLATIONS.en.qc2_high_balance, '≥2k');
  assert.equal(TRANSLATIONS.ur.qc2_high_balance, '≥2k');
});

// --- (6)+(7)+(8)+(9)+(10) Tonal styles, all token-only --------------

test('(6) the action buttons are semantic tonal buttons', () => {
  assert.match(styles, /\.qc3-action-btn--call\s*\{[^}]*background:\s*var\(--qc-blue-bg\)/, 'Call must be soft blue');
  assert.match(styles, /\.qc3-action-btn--call\s*\{[^}]*color:\s*var\(--qc-blue-text\)/, 'Call text must be blue');
  assert.match(styles, /\.qc3-action-btn--location\s*\{[^}]*background:\s*var\(--qc-amber-bg\)/, 'Location must be soft amber');
  assert.match(styles, /\.qc3-collect\s*\{[^}]*background:\s*linear-gradient\(180deg, var\(--qc-collect-from\), var\(--ds-success\)\)/, 'Collect must be the emerald gradient');
  assert.match(styles, /\.qc3-collect\s*\{[^}]*box-shadow:\s*0 4px 12px rgba\(22, 163, 74, 0.25\)/, 'Collect must carry its shadow');
  assert.match(styles, /\.qc3-collect:active\s*\{[^}]*transform:\s*scale\(0.98\)/, 'Collect must press in');
  assert.match(styles, /\.qc3-collect\s*\{[^}]*border-radius:\s*10px/, 'Collect radius must be 10px');
  assert.match(styles, /\.qc3-collect\s*\{[^}]*font-weight:\s*600/, 'Collect weight must be 600');
});

test('(7) the priority tiers carry a 4px left accent and tier colours', () => {
  assert.match(styles, /\.qc-customer-card\.qc2-priority--high\s*\{[^}]*border-left:\s*4px solid var\(--qc-high-border\)/, 'High accent must be 4px red');
  assert.match(styles, /\.qc-customer-card\.qc2-priority--medium\s*\{[^}]*border-left:\s*4px solid var\(--qc-amber-strong-border\)/, 'Medium accent must be 4px amber');
  assert.match(styles, /\.qc-customer-card\.qc2-priority--low\s*\{[^}]*border-left:\s*4px solid var\(--qc-low-border\)/, 'Low accent must be 4px sky blue');
  assert.match(styles, /\.qc2-badge--high\s*\{[^}]*color:\s*var\(--ds-danger-strong\)/, 'High badge must be red');
  assert.match(styles, /\.qc2-badge--medium\s*\{[^}]*color:\s*var\(--qc-amber-strong-text\)/, 'Medium badge must be amber');
  assert.match(styles, /\.qc2-badge--low\s*\{[^}]*color:\s*var\(--qc-low-text\)/, 'Low badge must be sky blue');
});

test('(8) the scroll container is tinted and the #ID badge is an emerald-tint pill', () => {
  assert.match(styles, /\.qc-customer-list\s*\{[^}]*background:\s*var\(--color-slate-100\)/, 'list tint must be #F1F5F9');
  assert.match(styles, /#quickCollectModal \.quick-collect-card\s*\{[^}]*background:\s*var\(--qc-scroll-tint\)/, 'card tint must be #F2F6F4');
  assert.match(styles, /\.qc-customer-card\.qc3-card\s*\{[^}]*box-shadow:\s*0 2px 8px rgba\(15, 23, 42, 0.06\)/, 'cards must be white with the soft shadow');
  assert.match(styles, /\.qc-cust-num\s*\{[^}]*background:\s*var\(--qc-mint-bg\)/, 'ID badge must be emerald-tint');
  assert.match(styles, /\.qc-cust-num\s*\{[^}]*color:\s*var\(--qc-emerald-text\)/, 'ID badge text must be emerald');
  assert.match(styles, /\.qc-cust-num\s*\{[^}]*font-weight:\s*700/, 'ID badge must be weight 700');
});

test('(9) the High filter pill is rose and the counts are counter badges', () => {
  assert.match(styles, /\.quick-collect-filter-chip\.qc-filter-high\s*\{[^}]*background:\s*var\(--qc-rose-bg\)/, 'High pill must be rose');
  assert.match(styles, /\.qc-count-badge\s*\{[^}]*border-radius:\s*999px/, 'counts must be rounded badges');
  assert.match(html, /<span class="qc-count-badge" id="quickCollectDuesCount">0<\/span>/, 'Pending count must be a badge, not parens');
  assert.equal(html.includes('(<span id="quickCollectDuesCount">'), false, 'no parens around the counts');
  assert.match(styles, /#quickCollectModal \.help-info-btn\s*\{[^}]*width:\s*36px/, 'header info button must be 36px');
  assert.match(styles, /#quickCollectModal #closeQuickCollectModalBtn\s*\{[^}]*width:\s*36px !important/, 'header close button must be 36px');
});

test('(10) Day Summary is a borderless mint button and the footer is a slate segmented bar', () => {
  assert.match(styles, /\.eds-summary-button\s*\{[^}]*background:\s*var\(--qc-mint-bg\)/, 'Day Summary must be mint');
  assert.match(styles, /\.eds-summary-button\s*\{[^}]*border-color:\s*transparent/, 'Day Summary must be borderless');
  assert.match(styles, /\.eds-summary-button\s*\{[^}]*color:\s*var\(--qc-mint-strong-text\)/, 'Day Summary text must be mint-dark');
  assert.match(styles, /\.qc-picker-footer\s*\{[^}]*background:\s*var\(--color-slate-50\)/, 'footer bar must be slate');
  assert.match(styles, /\.qc-picker-footer\s*\{[^}]*border:\s*1px solid var\(--ds-border\)/, 'footer bar border must be slate');
  assert.match(styles, /\.qc-picker-footer \.qc-footer-btn\s*\{[^}]*flex:\s*1 1 50%/, 'footer buttons must split 50/50');
});

// --- (11) One Screen entry view ---------------------------------------

test('(11) the amount display is a flat row with a fixed PKR badge, no green wrapper', () => {
  const screen = quickCollectOneScreenHtml({ customers: [], methods: METHODS });
  assert.ok(screen.includes('class="qos-amount-display"'), 'amount must sit in its display row');
  assert.ok(screen.includes('<span class="qos-pkr-badge"'), 'PKR badge must be fixed beside the amount');
  // QC Modal Overhaul 2 (addendum A1): the thick outer green wrapper
  // (light-green #F0FDF4 background + green border + padding) is
  // REMOVED — it pushed Payment Method off the bottom of the one
  // screen. The display is a plain flex row now: no background, no
  // border, no padding. The amount keeps its big figure and its
  // emerald focus ring.
  assert.doesNotMatch(styles, /\.qos-amount-display\s*\{[^}]*background:\s*var\(--ds-footer-good\)/, 'the green wrapper background must be gone');
  assert.doesNotMatch(styles, /\.qos-amount-display\s*\{[^}]*border:\s*1\.5px solid/, 'the green wrapper border must be gone');
  assert.match(styles, /\.qos-amount-display\s*\{[^}]*display:\s*flex/, 'the display must stay a flex row');
  assert.match(styles, /\.qos-amount-value\s*\{[^}]*font-size:\s*1.35rem/, 'POS amount must be 1.35rem');
  assert.match(styles, /\.qos-amount-value\s*\{[^}]*font-weight:\s*700/, 'POS amount must be weight 700');
  assert.match(styles, /\.qos-amount-value:focus\s*\{[^}]*outline:\s*2px solid var\(--color-emerald\)/, 'focus ring must be emerald, not blue');
});

test('(11) the preset chips are colour-coded by kind and carry their figures', () => {
  const chips = oneScreenQuickAmountButtonsHtml({ full: 3000, half: 1500, package: 2000 });
  assert.ok(chips.includes('qab-amount-chip--full'), 'Full dues chip must carry its kind');
  assert.ok(chips.includes('qab-amount-chip--half'), 'Half dues chip must carry its kind');
  assert.ok(chips.includes('qab-amount-chip--package'), 'Package price chip must carry its kind');
  assert.ok(chips.includes('Full dues (Rs 3,000)'), 'Full chip must name its figure');
  assert.match(styles, /\.qab-amount-chip--full\s*\{[^}]*background:\s*var\(--qc-mint-bg\)/, 'Full chip must be emerald');
  assert.match(styles, /\.qab-amount-chip--half\s*\{[^}]*background:\s*var\(--qc-amber-soft-bg\)/, 'Half chip must be amber');
  assert.match(styles, /\.qab-amount-chip--package\s*\{[^}]*background:\s*var\(--qc-blue-bg\)/, 'Package chip must be blue');
});

test('(11) the numpad keys are colour-coded by kind', () => {
  const keys = amountKeypadHtml();
  assert.ok(keys.includes('kpd-key--digit'), 'digits must carry their kind');
  assert.ok(keys.includes('kpd-key--clear'), 'C must carry its kind');
  assert.ok(keys.includes('kpd-key--backspace'), 'backspace must carry its kind');
  assert.match(styles, /\.kpd-key--digit\s*\{[^}]*background:\s*var\(--white\)/, 'digits must be elevated white');
  assert.match(styles, /\.kpd-key--clear\s*\{[^}]*background:\s*var\(--qc-rose-bg\)/, 'C must be rose');
  assert.match(styles, /\.kpd-key--backspace\s*\{[^}]*background:\s*var\(--ds-line\)/, 'backspace must be slate');
});

// --- (12) Searchable combobox + method pills --------------------------

function comboboxEntries() {
  return [
    { id: 'c-1', name: 'Amina', customerNumber: 25, mohalla: 'Chamyaa', totalDues: 3000 },
    { id: 'c-2', name: 'Bilal', customerNumber: 3, mohalla: 'Gangall', totalDues: 1500 },
    { id: 'c-3', name: 'Chanda', customerNumber: 9, mohalla: 'Barrian', totalDues: 0 },
    { id: 'c-4', name: 'Daud', customerNumber: 12, mohalla: 'Thalii', totalDues: null },
    { id: 'c-5', name: 'Archived One', customerNumber: 7, mohalla: 'Malla', totalDues: 5000, archived: true },
  ];
}

test('(12) the combobox puts pending-dues customers on top, largest first', () => {
  const choices = quickCollectOneScreenComboboxChoices(comboboxEntries());
  assert.deepEqual(choices.map((c) => c.value), ['c-1', 'c-2', 'c-3', 'c-4']);
  assert.equal(choices[0].dueTone, 'high');
  assert.equal(choices[1].dueTone, 'medium');
  assert.equal(choices[2].dueTone, 'paid');
  assert.equal(choices[3].dueTone, 'unknown');
});

test('(12) the combobox filters by name, #ID, and mohalla', () => {
  const choices = quickCollectOneScreenComboboxChoices(comboboxEntries());
  assert.deepEqual(quickCollectOneScreenComboboxFilter(choices, 'amina').map((c) => c.value), ['c-1']);
  assert.deepEqual(quickCollectOneScreenComboboxFilter(choices, '#3').map((c) => c.value), ['c-2']);
  assert.deepEqual(quickCollectOneScreenComboboxFilter(choices, 'gangall').map((c) => c.value), ['c-2']);
  assert.deepEqual(quickCollectOneScreenComboboxFilter(choices, '').map((c) => c.value), ['c-1', 'c-2', 'c-3', 'c-4']);
});

test('(12) the combobox option shows Mohalla and the Outstanding badge', () => {
  const [high, , paid, unknown] = quickCollectOneScreenComboboxChoices(comboboxEntries());
  assert.ok(quickCollectOneScreenComboboxOptionHtml(high).includes('PKR 3,000 Due'), 'High dues badge must read Due in red');
  assert.ok(quickCollectOneScreenComboboxOptionHtml(high).includes('qos-due-badge--high'), 'High badge must carry its tone');
  assert.ok(quickCollectOneScreenComboboxOptionHtml(high).includes('Chamyaa'), 'option must show the mohalla');
  assert.ok(quickCollectOneScreenComboboxOptionHtml(paid).includes('>Paid<'), 'settled customer must read Paid in green');
  assert.equal(quickCollectOneScreenComboboxOptionHtml(unknown).includes('qos-due-badge'), false, 'unknown dues must show no badge, never a guessed figure');
});

test('(12) the method pills group the shops and keep NayaPay, Raast and Bank distinct', () => {
  const { pills, shopMethods } = quickCollectOneScreenMethodPills(METHODS);
  assert.deepEqual(pills.map((p) => p.label), ['Cash', 'Easypaisa', 'JazzCash', 'NayaPay', 'Bank Transfer', 'Raast', 'Shop Drop-off']);
  // QC Modal Overhaul 2 (addendum A4): the sub-row offers the TWO
  // shops the user named — the legacy 'Cash at Hassan shop' /
  // 'Cash at Balla shop' spellings canonicalise to the unified
  // 'Cash at Hassan Balla shop' before dedup (same rule as
  // shop-settlement.js canonicalShopName). Four stored spellings,
  // two offered shops.
  assert.deepEqual(shopMethods, ['Cash at Waseem Abbasi shop', 'Cash at Hassan Balla shop']);
  assert.equal(quickCollectOneScreenShopShortLabel('Cash at Hassan Balla shop'), 'Hassan Balla');
  const screen = quickCollectOneScreenHtml({ customers: [], methods: METHODS });
  assert.ok(screen.includes('data-qos-method="NayaPay"'), 'NayaPay pill must submit its own value');
  assert.ok(screen.includes('data-qos-method="Raast"'), 'Raast pill must submit its own value');
  assert.ok(screen.includes('data-qos-method="Bank Transfer"'), 'Bank Transfer pill must submit its own value');
  assert.ok(screen.includes('data-qos-method="Cash at Hassan Balla shop"'), 'shop sub-pill must submit the unified stored method');
  assert.equal(screen.includes('data-qos-method="Cash at Hassan shop"'), false, 'no legacy Hassan sub-pill may remain');
  assert.equal(screen.includes('data-qos-method="Cash at Balla shop"'), false, 'no legacy Balla sub-pill may remain');
  assert.equal(screen.includes('<select'), false, 'no native select may remain on the one screen');
});

test('(12) Cash is pre-selected when nothing was picked', () => {
  assert.equal(quickCollectOneScreenResolveMethod('', METHODS), 'Cash');
  assert.equal(quickCollectOneScreenResolveMethod('JazzCash', METHODS), 'JazzCash');
  // QC Modal Overhaul 2 (addendum A4): a remembered legacy shop
  // method resolves to the unified shop — it IS that shop — instead
  // of falling back to Cash.
  assert.equal(quickCollectOneScreenResolveMethod('Cash at Balla shop', METHODS), 'Cash at Hassan Balla shop');
  assert.equal(quickCollectOneScreenResolveMethod('Cash at Hassan shop', METHODS), 'Cash at Hassan Balla shop');
  assert.equal(quickCollectOneScreenResolveMethod('Not a method', METHODS), 'Cash');
  const screen = quickCollectOneScreenHtml({ customers: [], methods: METHODS });
  assert.ok(screen.includes('id="qosOneScreenMethod" type="hidden" value="Cash"'), 'hidden method must carry the pre-selected Cash');
});

// --- (13) Truly one screen --------------------------------------------

test('(13) the save button names the amount it will save', () => {
  assert.equal(quickCollectOneScreenSaveLabel(''), '✓ Save Payment');
  assert.equal(quickCollectOneScreenSaveLabel('3000'), '✓ Save Payment (PKR 3,000)');
  assert.equal(quickCollectOneScreenSaveLabel('0'), '✓ Save Payment');
  const screen = quickCollectOneScreenHtml({ customers: [], methods: METHODS, amountText: '2000' });
  assert.ok(screen.includes('✓ Save Payment (PKR 2,000)'), 'rendered save button must name its amount');
});

test('(13) the one-screen keys are 42–44px with tighter gaps and the save bar is pinned', () => {
  assert.match(styles, /#quickCollectStepOneScreen \.kpd-keypad\s*\{[^}]*gap:\s*6px/, 'one-screen keypad gaps must be tighter');
  assert.match(styles, /#quickCollectStepOneScreen \.kpd-key\s*\{[^}]*min-height:\s*44px/, 'one-screen keys must be 44px');
  assert.match(styles, /\.qos-save-bar\s*\{[^}]*position:\s*sticky/, 'save bar must be pinned at the bottom');
  assert.match(styles, /\.qc-one-screen-save\s*\{[^}]*background:\s*linear-gradient\(180deg, var\(--qc-collect-from\), var\(--ds-success\)\)/, 'save CTA must be the emerald gradient');
});

// --- (14) Info-modal routing bug ---------------------------------------

test('(14) the help dialog is a nested overlay with a ✕ close and a Got-it button', () => {
  assert.match(html, /<dialog id="helpGuideDialog"[^>]*data-nested-dialog/, 'help dialog must be a nested dialog, never a root one');
  assert.match(html, /<button id="helpGuideCloseBtn"[^>]*>✕<\/button>/, 'close must be the standard ✕');
  assert.equal(HELP_GOT_IT_ID, 'helpGuideGotItBtn');
  assert.match(html, /<button id="helpGuideGotItBtn"[^>]*>✓ Got it, Thanks<\/button>/, 'Got-it button must be present');
  assert.ok(read('help-guide.js').includes("gotItBtn.addEventListener('click'"), 'Got-it must dismiss the popup');
  assert.match(styles, /dialog\.help-guide-modal::backdrop\s*\{[^}]*background:\s*rgba\(0, 0, 0, 0.45\)/, 'backdrop must be dimmed');
  assert.match(styles, /dialog\.help-guide-modal::backdrop\s*\{[^}]*backdrop-filter:\s*blur\(2px\)/, 'backdrop must blur');
  assert.match(styles, /dialog\.help-guide-modal\.billing-modal\s*\{[^}]*border-radius:\s*16px/, 'card radius must be 16px');
  assert.match(styles, /dialog\.help-guide-modal\.billing-modal\s*\{[^}]*box-shadow:\s*0 10px 25px rgba\(0, 0, 0, 0.15\)/, 'card shadow must be the specified one');
  assert.match(read('components.css'), /\.help-guide-modal \.help-guide-body\s*\{[^}]*line-height:\s*1.5/, 'body text must be line-height 1.5');
  assert.match(read('components.css'), /\.help-guide-modal \.help-guide-body\s*\{[^}]*font-size:\s*0.95rem/, 'body text must be 0.95rem');
  assert.match(styles, /\.help-guide-got-it-btn\s*\{[^}]*background:\s*var\(--qc-collect-from\)/, 'Got-it button must be #16A34A green');
});

// --- Ratchet: the user's palette lives in tokens.css, not styles.css ---

test('ratchet: styles.css stays at 613 distinct hex — the palette is tokens, not new hex', () => {
  // 614 → 613 with Customers Cards Compact (item B): deleting the
  // card's health-reasons rule removed its unique hex #62766d.
  assert.equal(distinctHex(styles).size, 613);
  assert.equal(distinctHex(read('components.css')).size, 0, 'components.css must stay hex-free');
});

test('ratchet: tokens.css carries the full --qc-* palette with dark values', () => {
  for (const token of ['--qc-blue-bg', '--qc-blue-border', '--qc-blue-text', '--qc-amber-bg', '--qc-amber-border', '--qc-amber-text', '--qc-amber-soft-bg', '--qc-amber-strong-border', '--qc-amber-strong-text', '--qc-collect-from', '--qc-high-border', '--qc-low-border', '--qc-low-bg', '--qc-low-text', '--qc-scroll-tint', '--qc-mint-bg', '--qc-mint-border', '--qc-mint-strong-text', '--qc-emerald-text', '--qc-chip-full-border', '--qc-rose-bg', '--qc-rose-border', '--qc-rose-text', '--qc-rose-strong-text', '--qc-indigo-bg', '--qc-indigo-text', '--qc-purple-bg', '--qc-purple-text']) {
    assert.ok(tokens.includes(`${token}:`), `tokens.css must define ${token}`);
  }
  assert.ok(tokens.includes('--qc-blue-bg: #eff6ff;'), 'Call blue must be the user-specified hex');
  assert.ok(tokens.includes('--qc-collect-from: #16a34a;'), 'Collect emerald must be the user-specified hex');
  assert.ok(tokens.includes('--qc-rose-text: #be123c;'), 'High pill rose must be the user-specified hex');
});
