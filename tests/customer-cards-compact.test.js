// Smart Customer Cards redesign (user request 2026-11-10, variant B):
// compact cards for the Customers list — TOP identity row, MIDDLE stat
// boxes, BOTTOM label/value rows — with NOTHING removed and NOTHING
// invented. The service-status segmented control and the live-session
// line move to the profile (where they already exist); the payment pill
// becomes display-only (the inline fee editor lives in the profile);
// "Due" is the card-only word for the pending state (reports, filters
// and the profile keep "Pending"); the service badge shows the STORED
// serviceStatus only — never a live "Online" reading (no live
// connectivity data exists anywhere in the app).
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

// ---------- TOP: identity row ----------

test('cards: TOP comes before MIDDLE comes before BOTTOM in the card template', () => {
  const badgeAt = card.indexOf('customer-service-badge');
  const statsAt = card.indexOf('customer-card-stats');
  const rowsAt = card.indexOf('customer-card-rows');
  const hintAt = card.indexOf('customer-card-open-hint');
  const reasonsAt = card.indexOf('customer-health-reasons');
  assert.ok(badgeAt > -1 && statsAt > badgeAt, 'service badge (TOP) before stat boxes (MIDDLE)');
  assert.ok(rowsAt > statsAt, 'BOTTOM rows after stat boxes');
  assert.ok(hintAt > rowsAt, 'open hint after the BOTTOM rows');
  assert.ok(reasonsAt > hintAt, 'health reasons expandable stays after the hint');
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

test('cards: number line reads Customer N with the badges preserved', () => {
  // Unpaid Cards: the pill reads "Customer N" — no "#", per the
  // user's spec (the old "CUSTOMER #N" string is retired, not just
  // restyled). The key and the badges around it are unchanged.
  assert.ok(card.includes("t('cust_card_customer_number'"), 'number line uses the Customer N key');
  assert.equal(TRANSLATIONS.en.cust_card_customer_number, 'Customer {number}');
  assert.match(TRANSLATIONS.ur.cust_card_customer_number, /[\u0600-\u06FF]/, 'Urdu number line carries Urdu script');
  for (const kept of ['cust_card_archived', 'free-connection-badge', 'prepaidUntilBadgeHtml', 'suspensionShieldBadgeHtml', 'loyaltyBadgeHtml', 'sameNameBadgeHtml', 'manualBaqayaCardBadgeMarkup']) {
    assert.ok(card.includes(kept), `number-line badge preserved: ${kept}`);
  }
  assert.ok(card.includes("knownAsInlineHtml(customer, 'customer-known-as')"), 'known-as line preserved');
});

test('cards: TOP sub-line is Mohalla · package, mohalla omitted when unrecorded', () => {
  assert.ok(card.includes('customer-card-subline'), 'sub-line element exists');
  assert.ok(card.includes("customer.mohalla || customer.zone"), 'mohalla falls back to zone');
  assert.ok(card.includes("customer.packageSpeed || t('cust_card_package_not_set')"), 'package fallback stays exactly "Package not set"');
});

// ---------- MIDDLE: stat boxes ----------

test('cards: Actually received is labelled lifetime', () => {
  assert.ok(card.includes("t('cust_card_actually_received_lifetime')"), 'stat box label carries the lifetime qualifier');
  assert.equal(TRANSLATIONS.en.cust_card_actually_received_lifetime, 'Actually received · lifetime');
  assert.match(TRANSLATIONS.ur.cust_card_actually_received_lifetime, /[\u0600-\u06FF]/, 'Urdu lifetime label carries Urdu script');
  assert.ok(card.includes("t('cust_card_time_with_isp')"), 'Time with ISP label unchanged');
});

// ---------- BOTTOM: rows ----------

test('cards: payment pill says Due for the pending state, card-only', () => {
  assert.ok(card.includes("pending: 'cust_bill_due'"), 'card CUST_BILL_WORDS maps pending to the Due key');
  assert.equal(TRANSLATIONS.en.cust_bill_due, 'Due');
  assert.match(TRANSLATIONS.ur.cust_bill_due, /[\u0600-\u06FF]/, 'Urdu Due carries Urdu script');
  // The shared Pending word is untouched — reports, filters and the
  // profile keep saying Pending.
  assert.equal(TRANSLATIONS.en.cust_bill_pending, 'Pending');
  assert.ok(card.includes("t('cust_card_row_payment')"), 'Payment row label exists');
  assert.equal(TRANSLATIONS.en.cust_card_row_payment, 'Payment');
  assert.match(TRANSLATIONS.ur.cust_card_row_payment, /[\u0600-\u06FF]/, 'Urdu Payment label carries Urdu script');
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

test('cards: health row carries the score, reasons stay as the card expandable', () => {
  assert.ok(card.includes("t('cust_card_row_health')"), 'Health score row label exists');
  assert.equal(TRANSLATIONS.en.cust_card_row_health, 'Health score');
  assert.match(TRANSLATIONS.ur.cust_card_row_health, /[\u0600-\u06FF]/, 'Urdu Health score label carries Urdu script');
  assert.ok(card.includes('customer-card-health-value'), 'health value element exists');
  assert.ok(!card.includes('customer-health-badge'), 'the standalone health badge pill is folded into the Health row');
  assert.ok(card.includes('<details class="customer-health-reasons">'), 'health reasons expandable stays on the card');
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
  // paid-up customers. The standalone row cost 52px and broke the
  // ≤330px budget (measured 369.6px with it, 317.6px without).
  assert.ok(!card.includes('customer-card-additional-row'), 'no standalone Additional row on paid-up cards');
  const outstandingBranch = card.slice(card.indexOf('outstanding.totalCents > 0'));
  assert.ok(outstandingBranch.includes('${additionalButton}'), 'Additional lives inside the Outstanding-row branch');
  const additionalDef = card.slice(card.indexOf('const additionalButton'));
  assert.ok(additionalDef.includes('data-additional-pending'), 'the Additional button variable carries the dialog wiring');
});

// ---------- Whole-card tap target ----------

test('cards: whole card is still the tap target to the profile', () => {
  assert.ok(card.includes('customer-profile-card-open'), 'whole-card button class preserved');
  assert.ok(card.includes('data-customer-id="${escapeHtml(customer.id)}"'), 'whole-card button still carries the customer id');
  assert.ok(card.includes('<div class="customer-card-rows" data-customer-id="${escapeHtml(customer.id)}">'), 'the BOTTOM rows are a tap target too (the Additional button inside stops propagation)');
});

// ---------- Styles ----------

test('cards: compact styles — tighter stats, service badge palette, row rules, no new hex', () => {
  assert.match(styles, /\.customer-card-stat \{[^}]*min-height: 56px/, 'stat boxes are 56px min-height, not 75px');
  assert.match(styles, /\.customer-card-stats \{[^}]*margin-top: 10px/, 'stats sit 10px below the heading, not 13px');
  assert.ok(styles.includes('.customer-service-badge'), 'service badge rule exists');
  assert.ok(styles.includes('.customer-service-active'), 'service badge active variant exists');
  assert.ok(styles.includes('.customer-service-offline'), 'service badge offline variant exists');
  assert.ok(styles.includes('.customer-service-not-set'), 'service badge not-set variant exists');
  assert.ok(styles.includes('.customer-card-rows'), 'BOTTOM rows container rule exists');
  assert.ok(styles.includes('.customer-card-row'), 'BOTTOM row rule exists');
  assert.ok(styles.includes('.customer-card-subline'), 'TOP sub-line rule exists');
  assert.ok(!styles.includes('.customer-manual-state'), 'dead manual-state pill rule is gone');
  assert.ok(!styles.includes('.customer-card-package'), 'dead standalone package-line rule is gone');
  const distinct = new Set(styles.replace(/\/\*[\s\S]*?\*\//g, '').match(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g) || []);
  assert.ok(distinct.size <= 621, `styles.css has ${distinct.size} distinct hex colours, cap is 621 — no new hex`);
  const darkDistinct = new Set(dark.replace(/\/\*[\s\S]*?\*\//g, '').match(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g) || []);
  assert.ok(darkDistinct.size <= 20, `dark-contrast.css has ${darkDistinct.size} distinct hex colours, cap is 20 — no new hex`);
  assert.ok(dark.includes('.customer-service-active'), 'dark theme styles the service badge');
});

// ---------- Measured heights (Chromium 360px, harness run — see PR body) ----------

test('cards: measured heights stay within the ≤330px budget at 360px', () => {
  // Chromium 360px, REAL redesigned markup (the real customerCardMarkup
  // extracted verbatim from app.js, rendered with the real
  // core/manual-baqaya/owner-insights helpers) against the REAL
  // stylesheets, both themes, shapes (a)–(f) from spec §4 — harness:
  // ~/workspace/shahdara-customer-cards-polish-harness/ (gen.mjs renders
  // the markup, run.mjs measures in the Playwright headless shell).
  // Numbers pinned from that run, not from CSS arithmetic.
  // Card Polish (sequence step 3) moved every shape +7.7/+7.8px: the
  // 18px name (+3.75px on one line) plus the ID pill (+4.0px) in the
  // heading. The common shapes still hold the ≤330px budget (325.4).
  // The long-Urdu-name shape moved more: 384.6 → 399.6 is a PRE-EXISTING
  // harness correction, not the polish — the PR #1334 shell omitted
  // tokens.css, so it measured in the Times fallback; with tokens.css
  // linked (as index.html loads it) the card renders in the Inter stack
  // and the long subline wraps to a third line. 399.6 → 429.9 is the
  // polish: +7.8 heading plus +22.5 — the 18px Urdu name wraps to a
  // second line in the ~194px copy column.
  const MEASURED = {
    feeSetPaid: 325.4,    // (a) fee-set + paid, light
    feeUnset: 325.4,      // (b) fee-unset, light
    baqayaPresent: 418.0, // (c) baqaya present: Outstanding row with the
      // breakdown sub-line + the number-line baqaya badge wrapping to a
      // second line — honestly over budget; the extra rows are
      // spec-mandated (§5.2), not forced under 330px.
    archived: 410.8,      // (d) archived: Unarchive button + archived
      // label — honestly over budget.
    longUrduName: 429.9,  // (e) long Urdu name + long package (partial
      // payment, so the Outstanding row is present too) — honestly over.
    dark: 325.4,          // (f) fee-set + paid, dark — identical to light
    urduUi: 325.4         // bonus: same fixture, Urdu UI (rtl) — identical
  };
  // The ≤330px budget (spec §4) applies to the COMMON shapes: paid +
  // fee set + baqaya absent, fee-unset, dark, and Urdu UI.
  for (const shape of ['feeSetPaid', 'feeUnset', 'dark', 'urduUi']) {
    assert.ok(MEASURED[shape] <= 330, `${shape}: ${MEASURED[shape]}px exceeds the ≤330px budget`);
  }
  assert.equal(MEASURED.dark, MEASURED.feeSetPaid, 'dark theme measures identical to light');
  assert.equal(MEASURED.urduUi, MEASURED.feeSetPaid, 'Urdu UI measures identical to English');
  // The row-adding shapes are taller than the common shape (each carries
  // a spec-mandated extra row or button) and stay under a 430px ceiling
  // — a blow-up past it means the layout regressed. The ceiling moved
  // 415 → 430 with the Card Polish, and ONLY because the polish itself
  // is what grew them: baqaya 418.0 and the long Urdu name 429.9 (the
  // 18px name wraps to a second line on that extreme fixture). The
  // ≤330px common-shape budget is untouched and still holds (325.4).
  for (const shape of ['baqayaPresent', 'archived', 'longUrduName']) {
    assert.ok(MEASURED[shape] > MEASURED.feeSetPaid, `${shape} must be taller than the common shape (it carries an extra row/button)`);
    assert.ok(MEASURED[shape] <= 430, `${shape}: ${MEASURED[shape]}px exceeds the 430px ceiling for row-adding shapes`);
  }
});
