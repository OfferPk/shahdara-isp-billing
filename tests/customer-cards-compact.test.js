// Customers Cards Compact (user request 2026-11-14, item B — PILL
// EVERYTHING + NO EMPTY SPACE): compact cards for the Customers list —
// TOP header row ([#N] badge + Bold Name + status pill + Paid/Due pill
// or Clear-dues), a conditional badge strip, pill rows (Father/ref +
// mohalla · package; Lifetime + tenure; Health), the Outstanding row
// only when owed, and the card ENDS at the action row
// [Call] | [Collect] | [Full Profile →] (Collect flex:1).
//
// REMOVED with the old card: the `Customer N` pill, the wide grey
// input-box name style, the two stat boxes, the Payment + Health label
// rows, the open-hint button, and the health-reasons <details> — the
// reasons live in the profile's Billing tab only (B2). Pill rows sit
// flex-start (adjacent), NEVER space-between — a trailing tail is NOT
// a dead band, pills are never stretched to fill the row.
//
// Fixtures are generic placeholders only ("Customer A", pattern-fake
// phone 03012345678 family) — no real customer data from any screenshot.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  addManualBaqayaEntry,
  calculatePaymentAllocations,
  addPayment,
  saveBillMonth
} from '../core.js';
import { totalOutstandingFigures } from '../manual-baqaya.js';
import { TRANSLATIONS } from '../nav-language.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const read = (file) => readFileSync(path.join(__dirname, '..', file), 'utf8');
const app = read('app.js');
const styles = read('styles.css');
const dark = read('dark-contrast.css');

const cardStart = app.indexOf('function customerCardMarkup(');
assert.ok(cardStart > -1, 'customerCardMarkup exists');
const cardEnd = app.indexOf('\n}\n', cardStart);
const card = app.slice(cardStart, cardEnd);

const REF = new Date('2026-10-15T10:00:00Z');
const MONTH = '2026-10';

function baseCustomer(overrides = {}) {
  return {
    id: 'cust-1',
    customerNumber: 101,
    name: 'Customer A',
    phone: '03012345678',
    area: 'Test Area',
    archived: false,
    isFreeConnection: false,
    monthlyPriceSchedule: [],
    relocationLog: [],
    pauseSkippedMonths: [],
    bills: [],
    incidents: [],
    installmentPlans: [],
    ...overrides
  };
}

function stateWithBill({ paid = false } = {}) {
  let state = { version: 1, nextCustomerNumber: 102, customers: [baseCustomer()] };
  state = saveBillMonth(state, 'cust-1', { month: MONTH, dueAmount: 3000, status: 'pending' }, REF);
  if (paid) state = addPayment(state, 'cust-1', MONTH, { date: '2026-10-05', amount: 3000, method: 'Cash' }, REF);
  return state;
}

// ---------- TOP: compact header ----------

test('cards: header comes before badge strip before pill rows before actions — and the card ENDS at the action row', () => {
  const badgeAt = card.indexOf('customer-service-badge');
  const stripAt = card.indexOf('customer-card-badge-strip');
  const pillRowAt = card.indexOf('customer-card-pill-row');
  const healthAt = card.indexOf('customer-card-health-pill');
  const rowsAt = card.indexOf('customer-card-rows');
  const actionsAt = card.indexOf('customer-card-actions');
  assert.ok(badgeAt > -1 && stripAt > badgeAt, 'service badge (header) before the badge strip');
  assert.ok(pillRowAt > stripAt, 'pill rows after the badge strip');
  assert.ok(healthAt > pillRowAt, 'health pill after the other pill rows');
  assert.ok(rowsAt > healthAt, 'Outstanding rows after the health pill');
  assert.ok(actionsAt > rowsAt, 'action row after the rows — the card ends here');
  assert.ok(card.indexOf('customer-card-actions', actionsAt + 1) === -1, 'one action row only');
  // The old card's blocks are all gone — nothing may render after the
  // action row, and the deleted elements must not appear anywhere.
  for (const gone of ['customer-card-stats', 'customer-card-open-hint', 'customer-health-reasons', 'customer-name-pill', 'customer-card-subline', 'customer-card-health-value']) {
    assert.ok(!card.includes(gone), `deleted element is gone from the card: ${gone}`);
  }
  assert.ok(!card.includes("t('cust_card_customer_number'"), 'Customer N key is gone from the card');
  assert.ok(!card.includes("t('cust_card_row_payment'"), 'Payment row label is gone from the card');
  assert.ok(!card.includes("t('cust_card_row_health'"), 'Health score row label is gone from the card');
});

test('cards: service badge is the bare word only, with the full status in its aria-label', () => {
  // The badge text is the bare service word (Active / Offline / Not set);
  // the "Service status: …" phrasing lives only in the aria-label, so a
  // screen reader still hears the full status.
  assert.ok(card.includes('customer-service-${serviceStatus}'), 'badge class carries the stored status');
  assert.ok(card.includes("aria-label=\"${escapeHtml(serviceAria)}\""), 'badge carries the full-status aria-label');
  assert.ok(!card.includes('customer-manual-state'), 'the old 92px "Service status: …" pill is gone from the card');
  assert.ok(card.includes("const serviceStatus = ['active', 'offline', 'not-set'].includes(customer.serviceStatus) ? customer.serviceStatus : 'not-set'"), 'unknown/missing status falls back to not-set, never an undefined class');
});

test('cards: header is [#N] badge + Bold Name + status pill + billing pill, badges in a strip below', () => {
  // The Customer N pill is retired (D-B1/B2): the [#N] badge keeps the
  // ID-pill rotation, the name is bold plain text (no pill, no grey
  // input-box look), and the status + billing pills sit at the right.
  assert.ok(card.includes('customer-id-pill'), 'header keeps the [#N] badge with the ID-pill rotation');
  assert.ok(card.includes('customer-card-name'), 'name is a plain bold element, not a pill');
  assert.ok(card.includes('dir="auto"'), 'name carries dir="auto" for Urdu names');
  assert.equal(TRANSLATIONS.en.cust_card_customer_number, undefined, 'Customer N key deleted from the English dict');
  assert.equal(TRANSLATIONS.ur.cust_card_customer_number, undefined, 'Customer N key deleted from the Urdu dict');
  // Number-line badges (FREE, prepaid, suspension, loyalty, same-name,
  // archived, manual-baqaya) live in the conditional strip under the
  // header — the strip renders nothing when there is no badge (R1).
  assert.ok(card.includes('badgeStripInner'), 'badge strip is built from the number-line badges');
  assert.ok(card.includes('badgeStripInner.trim() ?'), 'strip renders only when a badge exists');
  for (const kept of ['cust_card_archived', 'free-connection-badge', 'prepaidUntilBadgeHtml', 'suspensionShieldBadgeHtml', 'loyaltyBadgeHtml', 'sameNameBadgeHtml', 'manualBaqayaCardBadgeMarkup']) {
    assert.ok(card.includes(kept), `number-line badge preserved in the strip: ${kept}`);
  }
  // The known-as name is a pill in the sub-line row, not an inline line.
  // The label key is chosen by a ternary (father field vs nickname),
  // so the card carries the bare key strings, not a t('…') call.
  assert.ok(card.includes('knownAsNameFor(customer)'), 'known-as name comes from knownAsNameFor');
  assert.ok(card.includes("'cust_card_father_ref_short'"), 'Father/reference pill label exists');
  assert.ok(card.includes("'cust_card_alias_short'"), 'alias pill label exists');
  assert.equal(TRANSLATIONS.en.cust_card_father_ref_short, 'Father / Ref');
  assert.equal(TRANSLATIONS.en.cust_card_alias_short, 'AKA');
  assert.match(TRANSLATIONS.ur.cust_card_father_ref_short, /[\u0600-\u06FF]/, 'Urdu Father/Ref label carries Urdu script');
  assert.match(TRANSLATIONS.ur.cust_card_alias_short, /[\u0600-\u06FF]/, 'Urdu alias label carries Urdu script');
});

test('cards: pill row is Father/ref + Mohalla · package, mohalla in Title Case', () => {
  assert.ok(card.includes('customer-card-pill-row'), 'pill-row container exists');
  assert.ok(card.includes('customer-card-meta-pill'), 'meta-pill class exists');
  assert.ok(card.includes("customer.mohalla || customer.zone"), 'mohalla falls back to zone');
  assert.ok(card.includes('canonicalMohalla(mohallaRaw)?.label'), 'mohalla casing comes from canonicalMohalla().label (Title Case, not the ALL-CAPS recovery labels)');
  assert.ok(card.includes("customer.packageSpeed || t('cust_card_package_not_set')"), 'package fallback stays exactly "Package not set"');
});

// ---------- MIDDLE: condensed pills ----------

test('cards: Lifetime + tenure are TWO condensed pills in one row', () => {
  assert.ok(card.includes('customer-card-lifetime-pill'), 'lifetime pill exists');
  assert.ok(card.includes('customer-card-tenure-pill'), 'tenure pill exists');
  assert.ok(card.includes("t('cust_card_lifetime_label'"), 'lifetime pill label exists');
  assert.equal(TRANSLATIONS.en.cust_card_lifetime_label, 'Lifetime');
  assert.match(TRANSLATIONS.ur.cust_card_lifetime_label, /[\u0600-\u06FF]/, 'Urdu lifetime label carries Urdu script');
  assert.ok(card.includes("t('cust_card_no_receipts'"), 'zero-receipts lifetime text stays');
  // The count is a bare (N) after the value — `Lifetime: <value> (N)` —
  // so the old '{count} recorded receipts' key has no user left and
  // was deleted with the stat boxes.
  assert.ok(card.includes('(${receipts.receiptCount})'), 'receipts count rides bare in the lifetime pill');
  assert.equal(TRANSLATIONS.en.cust_card_recorded_receipts, undefined, 'recorded-receipts key deleted from the English dict');
  assert.equal(TRANSLATIONS.ur.cust_card_recorded_receipts, undefined, 'recorded-receipts key deleted from the Urdu dict');
  assert.ok(card.includes("t('cust_card_tenure_months_short'"), 'tenure months label exists');
  assert.ok(card.includes("t('cust_card_tenure_since_short'"), 'tenure since label exists');
  assert.equal(TRANSLATIONS.en.cust_card_tenure_months_short, '{n} mos');
  assert.equal(TRANSLATIONS.en.cust_card_tenure_since_short, 'since {date}');
  assert.match(TRANSLATIONS.ur.cust_card_tenure_months_short, /[\u0600-\u06FF]/, 'Urdu tenure months label carries Urdu script');
  assert.match(TRANSLATIONS.ur.cust_card_tenure_since_short, /[\u0600-\u06FF]/, 'Urdu tenure since label carries Urdu script');
  // The old stat-box keys are deleted with the boxes.
  assert.equal(TRANSLATIONS.en.cust_card_actually_received_lifetime, undefined, 'lifetime stat-box key deleted from the English dict');
  assert.equal(TRANSLATIONS.ur.cust_card_actually_received_lifetime, undefined, 'lifetime stat-box key deleted from the Urdu dict');
});

// ---------- BOTTOM: header billing pill + Outstanding row ----------

test('cards: header pill says Due for the pending state, card-only — the Payment row is gone', () => {
  assert.ok(card.includes("pending: 'cust_bill_due'"), 'card CUST_BILL_WORDS maps pending to the Due key');
  assert.equal(TRANSLATIONS.en.cust_bill_due, 'Due');
  assert.match(TRANSLATIONS.ur.cust_bill_due, /[\u0600-\u06FF]/, 'Urdu Due carries Urdu script');
  // The shared Pending word is untouched — reports, filters and the
  // profile keep saying Pending.
  assert.equal(TRANSLATIONS.en.cust_bill_pending, 'Pending');
  // D-B1: the Payment label is DROPPED — the header pill IS the payment
  // state. The Clear-dues button moves into the header pill's seat.
  assert.equal(TRANSLATIONS.en.cust_card_row_payment, undefined, 'Payment row key deleted from the English dict');
  assert.equal(TRANSLATIONS.ur.cust_card_row_payment, undefined, 'Payment row key deleted from the Urdu dict');
  assert.ok(card.includes('customer-card-clear-dues'), 'Clear-dues sits in the header pill seat');
  assert.ok(card.includes('data-clear-dues-card'), 'Clear-dues keeps its card gate');
  // Display-only: no inline-edit hook on the card any more.
  assert.ok(!card.includes('data-inline-bill-edit'), 'billing badge is display-only on the card (edit lives in the profile)');
  assert.ok(!card.includes('cust_card_bill_badge_aria'), 'no edit-action aria-label on the display pill');
});

test('cards: outstanding row is gated on total > 0, with the baqaya breakdown as its sub-line', () => {
  assert.ok(card.includes('outstanding.totalCents > 0'), 'Outstanding row renders only when something is owed');
  assert.ok(card.includes("t('cust_card_row_outstanding')"), 'Outstanding row label exists');
  assert.equal(TRANSLATIONS.en.cust_card_row_outstanding, 'Outstanding');
  assert.match(TRANSLATIONS.ur.cust_card_row_outstanding, /[\u0600-\u06FF]/, 'Urdu Outstanding label carries Urdu script');
  assert.ok(card.includes("t('addpend_breakdown'"), 'baqaya breakdown uses the existing addpend_breakdown key');
  // The gate reads totalOutstandingFigures (bills + baqaya, the same
  // figure the profile shows) — pin the helper with fixtures:
  // bill dues only -> owed; baqaya only -> owed; neither -> nothing.
  const billOnly = stateWithBill();
  assert.equal(totalOutstandingFigures(billOnly.customers[0], calculatePaymentAllocations(billOnly)).total, 3000);
  const baqayaOnly = addManualBaqayaEntry(stateWithBill({ paid: true }), 'cust-1', { amount: 1500, date: '2026-09-10', note: 'Last month balance' }, REF);
  assert.equal(totalOutstandingFigures(baqayaOnly.customers[0], calculatePaymentAllocations(baqayaOnly)).total, 1500);
  const paidUp = stateWithBill({ paid: true });
  assert.equal(totalOutstandingFigures(paidUp.customers[0], calculatePaymentAllocations(paidUp)).total, 0);
});

test('cards: health is ONE pill, reasons are deleted from the card but live in the profile', () => {
  // D-B2: `Health: NN/100 · Good` — one pill, score band coloured; the
  // no-score case is a neutral meta-pill, never red.
  assert.ok(card.includes('customer-card-health-pill'), 'health pill exists');
  assert.ok(card.includes('healthPillText'), 'health pill text is built once');
  assert.ok(card.includes("t('cust_card_health')"), 'health pill label uses the Health key');
  assert.ok(card.includes('healthBandClass'), 'health pill carries the score-band class');
  assert.equal(TRANSLATIONS.en.cust_card_row_health, undefined, 'Health score row key deleted from the English dict');
  assert.equal(TRANSLATIONS.ur.cust_card_row_health, undefined, 'Health score row key deleted from the Urdu dict');
  // B2: the reasons <details> is DELETED from the card entirely — the
  // helper, the constant, the import, the CSS and the dark rule go with
  // it. The profile needs no change: it already renders the same
  // reasons in its Billing tab (profileReceiptSummaryMarkup).
  assert.ok(!card.includes('<details class="customer-health-reasons">'), 'health reasons expandable is gone from the card');
  assert.ok(!card.includes('healthReasons'), 'healthReasons variable is gone from the card');
  assert.ok(!card.includes('customerHealthReasonPillClass'), 'reason-pill helper is gone from the card');
  assert.ok(!app.includes('customerHealthReasonPillClass'), 'reason-pill helper import is gone from app.js');
  assert.ok(!styles.includes('.customer-health-reasons'), 'reasons rule is gone from styles.css');
  assert.ok(!styles.includes('.customer-health-reason-pill'), 'reason-pill rules are gone from styles.css');
  assert.ok(!dark.includes('.customer-health-reasons'), 'reasons rule is gone from dark-contrast.css');
  assert.ok(app.includes('(health?.reasons ?? []).map'), 'the profile still renders the health reasons (Billing tab)');
});

// ---------- What must NOT be on the card ----------

test('cards: no service-status control and no live-session line on the card', () => {
  assert.ok(!card.includes('data-set-service'), 'no service-status control on the card (it lives in the profile edit form)');
  assert.ok(!card.includes('service-choice-group'), 'no segmented service control on the card');
  assert.ok(!card.includes('liveSessionMarkup(customer)'), 'no live-session line on the card (it lives in the profile uptime panel)');
  // The concept mock's "Connection: Online" row is dropped, not built:
  // there is no live connectivity data anywhere in the app.
  assert.ok(!card.includes('Online'), 'no "Online" live-status string anywhere in the card markup');
});

test('cards: Additional stays on the card with the same dialog wiring', () => {
  assert.ok(card.includes('data-additional-pending'), 'Additional button keeps its dialog wiring');
  assert.ok(card.includes("t('addpend_add')"), '＋ Additional label preserved');
  assert.ok(card.includes("t('addpend_edit')"), '✎ edit aria-label preserved');
  assert.ok(card.includes('!archived && customer.isFreeConnection !== true'), 'archived / free connections show no Additional control');
  assert.ok(card.includes('data-unarchive-customer'), 'archived cards still show Unarchive');
  // Spec §5.2/§5.3 place Additional ONLY on the Outstanding row (＋
  // Additional when bill dues are owed, ✎ next to the breakdown when
  // baqaya > 0). A paid-up card has no Outstanding row, so it has no
  // Additional control — the control is preserved on every card with an
  // outstanding balance, and on the profile (Manual Baqaya section) for
  // paid-up customers.
  assert.ok(!card.includes('customer-card-additional-row'), 'no standalone Additional row on paid-up cards');
  const outstandingBranch = card.slice(card.indexOf('outstanding.totalCents > 0'));
  assert.ok(outstandingBranch.includes('${additionalButton}'), 'Additional lives inside the Outstanding-row branch');
  const additionalDef = card.slice(card.indexOf('const additionalButton'));
  assert.ok(additionalDef.includes('data-additional-pending'), 'the Additional button variable carries the dialog wiring');
});

// ---------- Action row + whole-card tap target ----------

test('cards: action row is [Call] | [Collect flex:1] | [Full Profile], Collect disabled on archived cards', () => {
  assert.ok(card.includes('customer-card-action-call'), 'Call action exists');
  assert.ok(card.includes('customer-card-action-collect'), 'Collect action exists');
  assert.ok(card.includes('customer-card-action-profile'), 'Full Profile action exists');
  assert.ok(card.includes("t('qc3_call')"), 'Call label reuses the Quick Collect key');
  assert.ok(card.includes("t('qc3_collect')"), 'Collect label reuses the Quick Collect key');
  assert.ok(card.includes("t('cust_card_open_profile')"), 'Full Profile label exists');
  assert.equal(TRANSLATIONS.en.cust_card_open_profile, 'Full Profile');
  assert.match(TRANSLATIONS.ur.cust_card_open_profile, /[\u0600-\u06FF]/, 'Urdu Full Profile label carries Urdu script');
  assert.ok(card.includes("dsIcon('Phone'"), 'Call icon is the existing Phone icon (zero new icons)');
  assert.ok(card.includes("dsIcon('CreditCard'"), 'Collect icon is the existing CreditCard icon');
  assert.ok(card.includes("dsIcon('UserPlus'"), 'Full Profile icon is UserPlus (D-B5, zero new icons)');
  // D-B4: Collect is DISABLED on archived cards — it must not widen the
  // open #1393 record-on-archived trap. The Unarchive button stays
  // after the action row on archived cards only.
  assert.ok(card.includes('archived ? \' disabled aria-disabled="true"\''), 'Collect carries the archived-disabled gate');
  assert.ok(card.includes('data-unarchive-customer'), 'Unarchive stays after the action row on archived cards');
});

test('cards: whole card is still the tap target to the profile, action buttons stop propagation', () => {
  assert.ok(card.includes('customer-profile-card-open'), 'whole-card button class preserved');
  assert.ok(card.includes('data-customer-id="${escapeHtml(customer.id)}"'), 'whole-card button still carries the customer id');
  assert.ok(card.includes('<div class="customer-card-rows" data-customer-id="${escapeHtml(customer.id)}">'), 'the BOTTOM rows are a tap target too (the Additional button inside stops propagation)');
  // No action button carries its own data-customer-id (the whole-card
  // tap would fire twice) — each carries only its data-card-* key.
  const cardIds = (card.match(/data-customer-id/g) || []).length;
  assert.equal(cardIds, 2, 'exactly two data-customer-id carriers in the card (whole-card button + rows div)');
  assert.ok(card.includes('data-card-call'), 'Call button carries data-card-call');
  assert.ok(card.includes('data-card-collect'), 'Collect button carries data-card-collect');
  assert.ok(card.includes('data-card-open-profile'), 'Full Profile button carries data-card-open-profile');
  // Bindings (renderCustomers, outside the card slice): every action
  // stops propagation, Collect uses the existing bridge with the
  // selectCustomer fallback (global-search Add Payment pattern), and
  // Full Profile selects the customer explicitly.
  assert.ok(app.includes("querySelectorAll('[data-card-call]')"), 'Call binding exists');
  assert.ok(app.includes("querySelectorAll('[data-card-collect]')"), 'Collect binding exists');
  assert.ok(app.includes("querySelectorAll('[data-card-open-profile]')"), 'Full Profile binding exists');
  assert.ok(app.includes('window.quickCollectModalController?.selectAndOpen'), 'Collect uses the existing Quick Collect bridge');
  assert.ok(app.includes('else selectCustomer(customerId)'), 'Collect falls back to selectCustomer');
});

// ---------- Styles ----------

test('cards: compact styles — pill rows flex-start, action row, no deleted rules, no new hex', () => {
  assert.ok(styles.includes('.customer-card-name'), 'bold name rule exists');
  assert.ok(styles.includes('.customer-card-badge-strip'), 'badge-strip rule exists');
  assert.ok(styles.includes('.customer-card-pill-row'), 'pill-row rule exists');
  assert.ok(styles.includes('.customer-card-meta-pill'), 'meta-pill rule exists');
  assert.ok(styles.includes('.customer-card-lifetime-pill'), 'lifetime-pill rule exists');
  assert.ok(styles.includes('.customer-card-tenure-pill'), 'tenure-pill rule exists');
  assert.ok(styles.includes('.customer-card-health-pill'), 'health-pill rule exists');
  assert.ok(styles.includes('.customer-card-actions'), 'action-row rule exists');
  assert.ok(styles.includes('.customer-card-action-btn'), 'action-button rule exists');
  assert.ok(styles.includes('.customer-service-badge'), 'service badge rule exists');
  assert.ok(styles.includes('.customer-service-active'), 'service badge active variant exists');
  assert.ok(styles.includes('.customer-service-offline'), 'service badge offline variant exists');
  assert.ok(styles.includes('.customer-service-not-set'), 'service badge not-set variant exists');
  assert.ok(styles.includes('.customer-card-rows'), 'BOTTOM rows container rule exists');
  assert.ok(styles.includes('.customer-card-row'), 'BOTTOM row rule exists');
  // B2: pill rows are flex-start (adjacent), NEVER space-between — a
  // space-between row leaves a dead middle.
  assert.match(styles, /\.customer-card-row \{[^}]*justify-content: flex-start/, 'rows are flex-start, not space-between');
  assert.match(styles, /\.customer-card-pill-row \{[^}]*justify-content: flex-start/, 'pill rows are flex-start, not space-between');
  // §3: Collect is flex:1 so the action row fills exactly.
  assert.match(styles, /\.customer-card-action-collect \{[^}]*flex: 1 1 0/, 'Collect is flex:1 in the action row');
  // Deleted rules are gone.
  for (const gone of ['.customer-card-stat ', '.customer-card-stats ', '.customer-card-subline', '.customer-card-open-hint', '.customer-name-pill', '.customer-health-reasons', '.customer-health-reason-pill', '.customer-card-health-value']) {
    assert.ok(!styles.includes(gone), `deleted rule is gone from styles.css: ${gone}`);
  }
  assert.ok(!styles.includes('.customer-manual-state'), 'dead manual-state pill rule is gone');
  assert.ok(!styles.includes('.customer-card-package'), 'dead standalone package-line rule is gone');
  // Hex ratchet: 614 → 613 — the unique-hex .customer-health-reasons
  // rule (#62766d) was deleted with the card reasons; #526a61 survives
  // via .transactions-count, so the count is 613, not 612. The exact
  // pin lives in profile-polish-a.test.js; this cap guards the same
  // move from this side (no new hex).
  const distinct = new Set(styles.replace(/\/\*[\s\S]*?\*\//g, '').match(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g) || []);
  assert.ok(distinct.size <= 613, `styles.css has ${distinct.size} distinct hex colours, cap is 613 — no new hex`);
  const darkDistinct = new Set(dark.replace(/\/\*[\s\S]*?\*\//g, '').match(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g) || []);
  assert.ok(darkDistinct.size <= 20, `dark-contrast.css has ${darkDistinct.size} distinct hex colours, cap is 20 — no new hex`);
  assert.ok(dark.includes('.customer-service-active'), 'dark theme styles the service badge');
});

// ---------- Measured heights (Chromium 360/320px, harness run — see PR body) ----------
// HARNESS NOT RUN in this session: Chromium SIGTRAPs at launch, 4
// attempts (measure.mjs ×3 with fresh TMPDIRs, minimal launch ×1) —
// the VM is under memory pressure (~457MB available). The numbers
// below are CSS ARITHMETIC estimates, NOT harness measurements, and
// must not be read as pins: common card ≈197px (button 12 + heading
// 26 + 3 pill rows ×28.5 + 12; rows div 2 + 8 + 36 + 13; li border 2);
// baqaya ≈245px (+48 Outstanding row with sub-line); archived
// ≈278px (+28.5 badge strip + 53 Unarchive); long-Urdu-name ≈231px
// (+34 Outstanding row, name/package truncate instead of wrapping);
// worst-case 320px ≈231px; no-score ≈197px. Pitch ≈207px (10px list
// gap) → ≈2.5 cards in a 518px list area, third partial — in line
// with D-B3's honest ~2.4 + partial. The D-B3 chrome squeeze is NOT
// applied: the arithmetic puts the common card below its 220px
// trigger either way. Phone check after deploy; the harness
// (~/workspace/tmp-prep-customers/harness-baseline/measure.mjs) is
// ready to re-run when the sandbox allows it.
test('cards: card ends at the action row — no block may follow it', () => {
  const actionsAt = card.indexOf('customer-card-actions');
  const afterActions = card.slice(actionsAt);
  assert.ok(!afterActions.includes('customer-card-stats'), 'no stats block after the action row');
  assert.ok(!afterActions.includes('customer-health-reasons'), 'no reasons block after the action row');
  assert.ok(!afterActions.includes('customer-card-open-hint'), 'no open hint after the action row');
});
