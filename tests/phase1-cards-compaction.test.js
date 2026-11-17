// Phase 1 — Customer Cards True 3-Per-Screen Compaction (user request
// 2026-11-17, screenshot-driven follow-up to Round 2): the standalone
// lifetime/tenure pill row is deleted — Lifetime rides the meta line as
// text, tenure rides the health row as the shrinking middle, the
// service badge moves off the heading onto the meta line; the name is
// 14.5px with a 95px floor; ＋ Additional never wraps; the health
// category colours are hardened; the FAB hides while scrolling; Plans
// 688 (prompt identity by build content hash) + 690 (versioned assets
// network-first) are implemented here (689 stays out); dist stays 23,
// the stamp reads "d23".
//
// Parent decisions D1–D12 (prep header) implemented here, NOT the spec
// as written:
// - D2: 688 + 690 in this PR; their slots become close-as-done on merge.
// - D3: dist stays 23; NO ?v=dist24; APP_VERSION stays '1.11.0'.
// - D4: action buttons stay 36px; the cap is met with 36px buttons.
// - D5: pills stay >= 11px; the name target is met by layout (95px
//   floor); Chromium-measured ~10–11 visible chars at 320px.
// - D6: the band class stays; the category rules are hardened with
//   !important; rose reuses Round 2's palette; no new hex.
// - D7: generic placeholder names in ALL tests (PII ratchet).
// - D8: <=165px pinned for paid-up cards; owed/baqaya are a DISCLOSED
//   EXCEPTION (compacted maximally, measured heights recorded here +
//   in the compact test's comment; the Outstanding row stays visible).
// - D9: FAB stays 40px/142px + 400px threshold; hidden WHILE ACTIVELY
//   SCROLLING, visible only after ~1s idle.
// - D10: Test 2 fixture = no-score "Health: insufficient history"
//   (lowercase — the real rendered text; the prep's capitalised form
//   was wrong); assert Additional height <= 25px at 320
//   (Chromium-measured 24.2px).
// - D11: the SINGLE customer-card token on the <li>; row rules
//   retargeted to the REAL classes (no parallel BEM system).
// - D12: stamp 9px, blessed (DS-0-badge precedent, pin + why-comment).
//
// Measured heights (Chromium headless shell, measure-p1-worktree.mjs,
// worktree at 45362300 + this change; base 45362300 in parens):
// 360px — paid-up 158.7 (195.7), paid-up+Ref 158.7 (195.7), owed
// 189.7 (229.7), baqaya 235.0 (278.0), worst long name 189.7 (229.7),
// Risk 63 / Critical 50 / Risk 75 189.7 (229.7);
// 320px — paid-up 158.7 (195.7), owed 189.7 (245.8), baqaya 235.0
// (278.0), worst long name 189.7 (245.8); 3-card stack thirdBottom
// 529 (649) against the 618px in-page budget at 360x740 — 3 cards
// fit. Additional 24.2px, 1 rect, both widths (was 40.4px wrapped
// at 320 widest). Name 95px at 320 (the floor). 0 page errors.
// FAB (scroll-fab probe, 10-card stack): hidden at scrollY 0/400;
// visible after idle at 450–800; geometric overlap WHILE VISIBLE
// (after idle) 33x30.4 at 550, 33x13.8 at 700 — disclosed: the FAB
// still covers a Profile button when it reappears after idle at some
// scroll positions (the parent kept 40px/142px); it never covers
// anything WHILE scrolling (hidden), and a touch of scroll reveals
// the button.
//
// Fixtures are generic placeholders only ("Customer A", pattern-fake
// phone 03012345678 family) — no real customer data from any
// screenshot. Risk/Critical fixtures are driven through
// buildCustomerHealthScore with real history — never a hand-edited
// health object.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import path from 'node:path';
import * as core from '../core.js';
import * as mbq from '../manual-baqaya.js';
import { buildCustomerHealthScore } from '../owner-insights.js';
import * as lang from '../nav-language.js';
import * as cardStyle from '../customer-card-style.js';
import * as knownAs from '../known-as-name.js';
import * as phase3 from '../phase3.js';
import * as dsIcons from '../ds-icons.js';
import {
  SW_UPDATE_EVENT,
  SW_UPDATE_SHOWN_KEY,
  SW_UPDATE_FROZEN_VERSION,
  swUpdateVersionFromCacheName,
  setupSwUpdatePrompt
} from '../nav-pwa.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const read = (file) => readFileSync(path.join(__dirname, '..', file), 'utf8');
const app = read('app.js');
const styles = read('styles.css');
const tokens = read('tokens.css');
const comp = read('components.css');
const indexHtml = read('index.html');
const navPwa = read('nav-pwa.js');
const swSource = read('sw.js');
const releaseAssurance = read('release-assurance.js');

lang.setAppLanguage('en');

const cardStart = app.indexOf('function customerCardMarkup(');
assert.ok(cardStart > -1, 'customerCardMarkup exists');
const card = app.slice(cardStart, app.indexOf('\n}\n', cardStart));

// ---------- render harness (customers-cards-round2.test.js factory, verbatim shape) ----------
function extract(src, sig) {
  const start = src.indexOf(sig);
  if (start < 0) throw new Error('missing ' + sig);
  let i = src.indexOf('{', start), depth = 0;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) return src.slice(start, i + 1); }
  }
  throw new Error('unbalanced ' + sig);
}
const fns = ['function initials', 'function tenurePresentation', 'function buildUrduTenure', 'function statusPresentation', 'function customerCardMarkup']
  .map((s) => extract(app, s)).join('\n');
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const humanDate = (date) => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeZone: core.PAKISTAN_TIME_ZONE }).format(new Date(`${date}T00:00:00Z`));
const displayCustomerName = (c) => c.name;
const knownAsInlineHtml = () => '';
const taggedFirstMonths = () => [];
const formatReceiptMonth = (m) => m;
const empty = () => '';
const localDate = () => new Date('2026-11-10T12:00:00+05:00');
const contactActionTargets = (phone) => {
  const compact = String(phone ?? '').replace(/[\s-]/g, '');
  if (!/^\+?\d{3,20}$/.test(compact)) return null;
  return { tel: `tel:${compact}`, whatsapp: null };
};
const plural = (count, one, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;
const factory = new Function('R', `
  const { t, escapeHtml, humanDate, displayCustomerName, knownAsInlineHtml, taggedFirstMonths, formatReceiptMonth,
    prepaidUntilBadgeHtml, suspensionShieldBadgeHtml, loyaltyBadgeHtml, sameNameBadgeHtml, localDate,
    summarizeCustomerReceipts, summarizeCustomerTenure, derivedBillStatus, totalOutstandingFigures,
    manualBaqayaCardBadgeMarkup, buildCustomerHealthScore, calculatePaymentAllocations, formatAmount, formatPKR, plural,
    customerIdPillClass, healthScoreBandClass, knownAsNameFor, canonicalMohalla, dsIcon, contactActionTargets,
    PAKISTAN_TIME_ZONE } = R;
  let state = R.state;
  let selectedBillingMonth = R.selectedBillingMonth;
  let selectedCustomerId = R.selectedCustomerId;
  let currentAppLanguage = R.currentAppLanguage;
  let customerRosterPill = 'all';
  ${fns}
  return { customerCardMarkup };
`);
function renderCard(customer, state, langCode = 'en', archived = false) {
  const tFn = langCode === 'ur' ? (key, _l, params) => lang.t(key, 'ur', params) : lang.t;
  const R = {
    t: tFn, escapeHtml, humanDate, displayCustomerName, knownAsInlineHtml, taggedFirstMonths,
    formatReceiptMonth, prepaidUntilBadgeHtml: empty, suspensionShieldBadgeHtml: empty,
    loyaltyBadgeHtml: empty, sameNameBadgeHtml: empty, localDate,
    summarizeCustomerReceipts: core.summarizeCustomerReceipts,
    summarizeCustomerTenure: core.summarizeCustomerTenure,
    derivedBillStatus: core.derivedBillStatus,
    totalOutstandingFigures: mbq.totalOutstandingFigures,
    manualBaqayaCardBadgeMarkup: mbq.manualBaqayaCardBadgeMarkup,
    buildCustomerHealthScore,
    calculatePaymentAllocations: core.calculatePaymentAllocations,
    formatAmount: core.formatPKR, formatPKR: core.formatPKR,
    customerIdPillClass: cardStyle.customerIdPillClass,
    healthScoreBandClass: cardStyle.healthScoreBandClass,
    knownAsNameFor: knownAs.knownAsNameFor,
    canonicalMohalla: phase3.canonicalMohalla,
    dsIcon: dsIcons.dsIcon,
    contactActionTargets,
    plural, PAKISTAN_TIME_ZONE: core.PAKISTAN_TIME_ZONE,
    state, selectedBillingMonth: '2026-10', selectedCustomerId: null,
    currentAppLanguage: () => langCode,
  };
  return factory(R).customerCardMarkup(customer, archived);
}
function pillClasses(html) {
  const m = html.match(/class="customer-card-health-pill([^"]*)"/);
  return m ? m[1] : null;
}
function plainText(html) {
  return html.replace(/<[^>]*>/g, '').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
}
function healthRowHtml(html) {
  const at = html.indexOf('customer-card-pill-row--spread');
  if (at === -1) return null;
  const rest = html.slice(at);
  const nextRow = rest.indexOf('<span class="customer-card-row">');
  const nextActions = rest.indexOf('<div class="customer-card-actions">');
  const end = Math.min(nextRow === -1 ? Infinity : nextRow, nextActions === -1 ? Infinity : nextActions);
  return end === Infinity ? rest : rest.slice(0, end);
}
function metaLineHtml(html) {
  const at = html.indexOf('customer-card-meta-line');
  if (at === -1) return null;
  const rest = html.slice(at);
  const end = rest.indexOf('</button>');
  return end === -1 ? rest : rest.slice(0, end);
}
// Extract a single CSS rule body by selector (first match). Anchored
// at a line start so a contextual strip (".meta-line .lifetime-pill")
// never shadows the base rule (".lifetime-pill").
function cssRule(css, selector) {
  const m = css.match(new RegExp(`^${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`, 'm'));
  return m ? m[1] : null;
}

// ---------- fixtures (generic placeholders only) ----------
const REF = new Date('2026-11-10T12:00:00+05:00');
function baseCustomer(overrides = {}) {
  return {
    id: 'cust-a', customerNumber: 12, name: 'Customer A', phone: '03012345678',
    connectionDate: '2026-06-01', monthlySellingAmount: 1000,
    packageSpeed: '3Mbps / 100GB', mohalla: 'Charyaa', zone: '',
    serviceStatus: 'active', archived: false, isFreeConnection: false,
    fatherOrReferenceName: '', searchAliases: [],
    bills: [], ...overrides,
  };
}
function mkState() { return core.createInitialState(['Customer A']); }
function bill(state, id, month, amount) {
  return core.saveBillMonth(state, id, { month, dueAmount: amount, status: 'pending' }, REF);
}
function pay(state, id, month, date, amount) {
  return core.addPayment(state, id, month, { date, amount: String(amount), method: 'Cash' }, REF);
}
// Paid-up, Father/Ref present, Charyaa 3Mbps/100GB, 6 mos tenure (r1 shape).
function paidUpState() {
  let state = mkState();
  const c = baseCustomer({ fatherOrReferenceName: 'Reference Person' });
  state.customers.push(c);
  for (const m of ['2026-08', '2026-09', '2026-10']) { state = bill(state, c.id, m, 1000); state = pay(state, c.id, m, `${m}-04`, 1000); }
  return { state, customer: state.customers.find((x) => x.id === c.id) };
}
// Owed: Oct bill unpaid.
function owedState() {
  let state = mkState();
  const c = baseCustomer();
  state.customers.push(c);
  state = bill(state, c.id, '2026-10', 1000);
  return { state, customer: state.customers.find((x) => x.id === c.id) };
}
// Baqaya: Oct paid + manual baqaya (the ✎ variant).
function baqayaState() {
  let state = mkState();
  const c = baseCustomer();
  state.customers.push(c);
  state = bill(state, c.id, '2026-10', 1000); state = pay(state, c.id, '2026-10', '2026-10-04', 1000);
  state = core.addManualBaqayaEntry(state, c.id, { amount: 1500, date: '2026-10-05', note: 'extra' }, REF);
  return { state, customer: state.customers.find((x) => x.id === c.id) };
}
// Risk (60–79) via real history: Sep paid, Oct unpaid → 63.
function riskState() {
  let state = mkState();
  const c = baseCustomer();
  state.customers.push(c);
  state = bill(state, c.id, '2026-09', 1000); state = pay(state, c.id, '2026-09', '2026-09-04', 1000);
  state = bill(state, c.id, '2026-10', 1000);
  return { state, customer: state.customers.find((x) => x.id === c.id) };
}
// Risk 75 via real history: Jul+Aug paid, Sep paid 12th, Oct unpaid.
function risk76State() {
  let state = mkState();
  const c = baseCustomer({ name: 'Customer Risk75' });
  state.customers.push(c);
  state = bill(state, c.id, '2026-07', 1000); state = pay(state, c.id, '2026-07', '2026-07-04', 1000);
  state = bill(state, c.id, '2026-08', 1000); state = pay(state, c.id, '2026-08', '2026-08-04', 1000);
  state = bill(state, c.id, '2026-09', 1000); state = pay(state, c.id, '2026-09', '2026-09-12', 1000);
  state = bill(state, c.id, '2026-10', 1000);
  return { state, customer: state.customers.find((x) => x.id === c.id) };
}
// Critical, 50–59 by label: Aug paid, Sep + Oct unpaid → 50.
function criticalState() {
  let state = mkState();
  const c = baseCustomer();
  state.customers.push(c);
  state = bill(state, c.id, '2026-08', 1000); state = pay(state, c.id, '2026-08', '2026-08-04', 1000);
  state = bill(state, c.id, '2026-09', 1000);
  state = bill(state, c.id, '2026-10', 1000);
  return { state, customer: state.customers.find((x) => x.id === c.id) };
}
// Good (≥80): Sep + Oct both paid on time → 100.
function goodState() {
  let state = mkState();
  const c = baseCustomer();
  state.customers.push(c);
  state = bill(state, c.id, '2026-09', 1000); state = pay(state, c.id, '2026-09', '2026-09-04', 1000);
  state = bill(state, c.id, '2026-10', 1000); state = pay(state, c.id, '2026-10', '2026-10-04', 1000);
  return { state, customer: state.customers.find((x) => x.id === c.id) };
}
// No score: 1 completed priced month only.
function noScoreState() {
  let state = mkState();
  const c = baseCustomer();
  state.customers.push(c);
  state = bill(state, c.id, '2026-10', 1000); state = pay(state, c.id, '2026-10', '2026-10-04', 1000);
  return { state, customer: state.customers.find((x) => x.id === c.id) };
}

// ---------- G1 — height / static budget (8) ----------

test('p1 G1a: the card <li> carries the customer-card token (D11)', () => {
  const { state, customer } = paidUpState();
  const html = renderCard(customer, state);
  assert.ok(html.includes('<li class="customer-item customer-card'), 'active card <li> carries the customer-card token');
  const archivedHtml = renderCard(customer, state, 'en', true);
  assert.ok(archivedHtml.includes('<li class="customer-item customer-card archived-customer-item'), 'archived card <li> keeps the token alongside archived-customer-item');
});

test('p1 G1b: no standalone lifetime/tenure pill row in the markup (the row is deleted)', () => {
  const { state, customer } = paidUpState();
  const html = renderCard(customer, state);
  assert.ok(!html.includes('class="customer-card-pill-row"'), 'no exact standalone pill-row class remains');
  assert.ok(html.includes('customer-card-pill-row--spread'), 'the health row (the ONE pill row) still exists');
});

test('p1 G1c: the meta line carries status • mohalla • package • Ref • Lifetime in order', () => {
  const { state, customer } = paidUpState();
  const html = renderCard(customer, state);
  const line = metaLineHtml(html);
  assert.ok(line, 'meta line exists');
  const order = ['Active', 'Charyaa', '3Mbps/100GB', 'Ref:', 'Lifetime:'];
  const at = order.map((seg) => line.indexOf(seg));
  assert.ok(at.every((i) => i > -1), `every meta segment renders (missing: ${order.filter((_, i) => at[i] === -1).join(', ')})`);
  assert.ok(at.every((v, i) => i === 0 || v > at[i - 1]), 'segments are in order: status • mohalla • package • Ref • Lifetime');
  assert.ok(line.includes('Charyaa • 3Mbps/100GB • Ref:'), 'the Round 2 substring is preserved');
});

test('p1 G1d: the tenure pill rides the health row as the shrinking middle', () => {
  const { state, customer } = paidUpState();
  const html = renderCard(customer, state);
  const row = healthRowHtml(html);
  assert.ok(row, 'health row exists');
  const healthAt = row.indexOf('customer-card-health-pill');
  const tenureAt = row.indexOf('customer-card-tenure-pill');
  const addAt = row.indexOf('additional-pending-btn');
  assert.ok(healthAt > -1 && tenureAt > -1 && addAt > -1, 'health pill, tenure pill and Additional are all on the row');
  assert.ok(healthAt < tenureAt && tenureAt < addAt, 'order is Health • Tenure • Additional');
  assert.match(plainText(row), /\d+ mos \(Jun '26\)/, 'the tenure text rides the row');
  const strip = cssRule(styles, '.customer-card-pill-row--spread .customer-card-tenure-pill');
  assert.ok(strip, 'the spread-row tenure strip rule exists');
  assert.match(strip, /flex:\s*0 1 auto/, 'the tenure shrinks before the Health pill or Additional');
  assert.match(strip, /min-width:\s*0/, 'the tenure can shrink to nothing');
  assert.match(strip, /background:\s*transparent/, 'the tenure pill chrome is stripped (plain text on the row)');
});

test('p1 G1e: the service badge is gone from the heading; the status rides the meta line', () => {
  const { state, customer } = paidUpState();
  const html = renderCard(customer, state);
  assert.ok(!html.includes('customer-service-badge'), 'no service badge in the heading (its width was the heading hog)');
  const line = metaLineHtml(html);
  assert.ok(line.includes('customer-card-meta-status'), 'the status rides the meta line as a plain segment');
  assert.ok(line.includes('aria-label="Service status: Active"'), 'the status keeps its accessible label');
  // The .customer-service-badge CSS rules stay (pinned by the Sharafat
  // 97 DATA + the compact test) — the class is unused on the card now.
  assert.ok(styles.includes('.customer-service-badge'), 'the badge rules stay in styles.css (pinned, unused on the card)');
});

test('p1 G1f: the name is 14.5px with a 95px floor (D5 — layout, not pill shrinking)', () => {
  assert.match(tokens, /--text-card-name:\s*14\.5px/, 'the name token is 14.5px');
  const nameRule = cssRule(styles, '.customer-card-name');
  assert.ok(nameRule, 'the name rule exists');
  assert.match(nameRule, /font-size:\s*var\(--text-card-name\)/, 'the name uses the token');
  assert.match(nameRule, /min-width:\s*95px/, 'the name never truncates to nothing at 320px');
  assert.match(nameRule, /flex:\s*1 1 auto/, 'the name still grows into the heading space');
});

test('p1 G1g: the height budget rules are tight (margins 5px, rows pad 10px, actions 2px + divider, list gap 8px)', () => {
  assert.match(cssRule(styles, '.customer-card-meta-line'), /margin-top:\s*5px/, 'meta line 8px -> 5px');
  assert.match(cssRule(styles, '.customer-card-pill-row'), /margin-top:\s*5px/, 'pill row 8px -> 5px');
  assert.match(cssRule(styles, '.customer-card-badge-strip'), /margin-top:\s*5px/, 'badge strip 8px -> 5px');
  assert.match(cssRule(styles, '.customer-card-rows'), /padding:\s*2px 14px 10px/, 'rows bottom pad 13px -> 10px');
  assert.match(cssRule(styles, '.customer-card-row'), /margin-top:\s*5px/, 'outstanding row 8px -> 5px');
  const actions = cssRule(styles, '.customer-card-actions');
  assert.match(actions, /margin-top:\s*2px/, 'actions row 8px -> 2px');
  assert.match(actions, /padding-top:\s*6px/, 'actions row gains a 6px top pad');
  assert.match(actions, /border-top:\s*1px solid #eef2f0/, 'actions row gains a hairline divider (a hex already in the 613 set)');
  const list620 = styles.match(/@media \(max-width: 620px\) \{\s*\/\* Phase 1[\s\S]*?\.customer-list, \.archived-customer-list \{([^}]*)\}/);
  assert.ok(list620, 'the <=620px list rule exists');
  assert.match(list620[1], /gap:\s*8px/, 'list gap 9px -> 8px');
  assert.match(list620[1], /padding:\s*6px 10px 76px 10px/, 'list bottom pad 14px -> 76px (clears the bottom nav + FAB zone)');
});

test('p1 G1h: the Outstanding row stays visible on owed and baqaya cards (D8 — money info is never hidden)', () => {
  const owed = owedState();
  const owedHtml = renderCard(owed.customer, owed.state);
  assert.ok(owedHtml.includes('customer-card-row'), 'owed card keeps its Outstanding row');
  assert.ok(plainText(owedHtml).includes('PKR 1,000'), 'the owed amount renders on the card');
  const baqaya = baqayaState();
  const baqayaHtml = renderCard(baqaya.customer, baqaya.state);
  assert.ok(baqayaHtml.includes('customer-card-row'), 'baqaya card keeps its Outstanding row');
  assert.ok(plainText(baqayaHtml).includes('PKR 1,500'), 'the baqaya amount renders on the card');
  // Disclosed exception (D8): owed 189.7px and baqaya 235.0px at both
  // widths exceed the 165px paid-up cap — the Outstanding row (money
  // info) is never hidden to meet the cap. Measured by Chromium, see
  // the header comment + the compact test's measured-heights comment.
});

// ---------- G2 — single-line Additional (5) ----------

test('p1 G2a: Additional never wraps (white-space: nowrap)', () => {
  const rule = cssRule(comp, '.additional-pending-btn');
  assert.ok(rule, 'the Additional rule exists in components.css');
  assert.match(rule, /white-space:\s*nowrap/, 'the label never wraps to two lines');
});

test('p1 G2b: Additional stays a 24px micro-pill (min-height 24px + defeater)', () => {
  const rule = cssRule(comp, '.additional-pending-btn');
  assert.match(rule, /min-height:\s*24px/, 'the 24px class rule stays');
  assert.match(comp, /button:not\(\[hidden\]\)\.additional-pending-btn \{[^}]*min-height: 24px !important;/s, 'the 24px defeater stays (Round 2 D1, recorded not blessed)');
  assert.match(rule, /font-size:\s*0\.75rem/, 'the label stays 12px (0.75rem)');
});

test('p1 G2c: the no-score fixture renders "Health: insufficient history" (D10 — the real widest text)', () => {
  const { state, customer } = noScoreState();
  const html = renderCard(customer, state);
  const text = plainText(html);
  // The category word renders lowercase ("insufficient history") —
  // the CUST_HEALTH_CATS map keys the capitalised form, so the raw
  // category word is what the pill shows. D10's "Insufficient" was
  // the prep's capitalisation; this is the real text.
  assert.ok(text.includes('Health: insufficient history'), 'the no-score health text renders');
  assert.ok(!pillClasses(html)?.includes('health-risk') && !pillClasses(html)?.includes('health-critical'), 'a no-score pill carries no Risk/Critical category');
});

test('p1 G2d: Additional stays on the health row (not the Outstanding row) on owed cards', () => {
  const { state, customer } = owedState();
  const html = renderCard(customer, state);
  const row = healthRowHtml(html);
  assert.ok(row && row.includes('additional-pending-btn'), 'Additional rides the health row when a bill is owed');
  const outAt = html.indexOf('<span class="customer-card-row">');
  const outRow = outAt === -1 ? '' : html.slice(outAt, html.indexOf('<div class="customer-card-actions">'));
  assert.ok(!outRow.includes('additional-pending-btn'), 'the Outstanding row does not carry the button');
});

test('p1 G2e: the ✎ variant stays on the health row for baqaya cards', () => {
  const { state, customer } = baqayaState();
  const html = renderCard(customer, state);
  const row = healthRowHtml(html);
  assert.ok(row && row.includes('additional-pending-btn'), 'the ✎ variant rides the health row');
  assert.ok(html.includes('✎'), 'the baqaya card renders the ✎ edit variant');
});

// ---------- G3 — health colour (5) ----------

test('p1 G3a: a Risk pill carries the amber category class AND the band class (D6 — band kept)', () => {
  const { state, customer } = risk76State();
  const html = renderCard(customer, state);
  const cls = pillClasses(html);
  assert.ok(cls, 'the health pill exists');
  assert.ok(cls.includes('health-risk'), 'Risk carries health-risk');
  assert.ok(cls.includes('health-score-high'), 'the band class stays alongside (compatibility)');
});

test('p1 G3b: the category rules are hardened (!important) so they beat the band regardless of order', () => {
  const risk = styles.match(/\.customer-card-health-pill\.health-risk\s*\{([^}]*)\}/);
  assert.ok(risk, 'the hardened Risk rule exists');
  assert.match(risk[1], /background:\s*#fffbeb\s*!important/, 'Risk background is !important amber');
  assert.match(risk[1], /color:\s*#b45309\s*!important/, 'Risk text is !important amber');
  assert.match(risk[1], /border:\s*1px solid #fde68a\s*!important/, 'Risk border is !important amber');
  const crit = styles.match(/\.customer-card-health-pill\.health-critical\s*\{([^}]*)\}/);
  assert.ok(crit, 'the hardened Critical rule exists');
  assert.match(crit[1], /background:\s*#ffebea\s*!important/, 'Critical background is !important rose');
  assert.match(crit[1], /color:\s*#a3342d\s*!important/, 'Critical text is !important rose');
  assert.match(crit[1], /border:\s*1px solid #fecaca\s*!important/, 'Critical border is !important rose');
});

test('p1 G3c: a Critical pill carries health-critical + the rose palette', () => {
  const { state, customer } = criticalState();
  const html = renderCard(customer, state);
  const cls = pillClasses(html);
  assert.ok(cls && cls.includes('health-critical'), 'Critical (50) carries health-critical');
  assert.ok(cls.includes('health-score-mid'), 'the band class stays alongside (50 >= 40 is the mid band)');
  // Computed (Chromium): Risk rgb(255,251,235) = #fffbeb, Critical
  // rgb(255,235,234) = #ffebea — the source values pinned above are
  // what the browser computes, now immune to source order.
});

test('p1 G3d: the category rules use only hexes already in the 613-token set (no new hex)', () => {
  const distinct = new Set(styles.replace(/\/\*[\s\S]*?\*\//g, '').match(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g) || []);
  assert.equal(distinct.size, 613, 'styles.css stays at 613 distinct hex (no new hard-coded colour)');
});

test('p1 G3e: a Good pill stays green (band only, no category class)', () => {
  const { state, customer } = goodState();
  const html = renderCard(customer, state);
  const cls = pillClasses(html);
  assert.ok(cls && cls.includes('health-score-high'), 'Good carries the green band');
  assert.ok(!cls.includes('health-risk') && !cls.includes('health-critical'), 'Good carries no Risk/Critical category');
});

// ---------- G4 — name width (4) ----------

test('p1 G4a: the name floor is 95px (the D5 target, met by layout)', () => {
  const nameRule = cssRule(styles, '.customer-card-name');
  assert.match(nameRule, /min-width:\s*95px/, 'the name floor is 95px');
  // Chromium-measured at 320px: the name renders at exactly the 95px
  // floor — ~10 visible chars for "Customer Risk75", ~11 for the
  // worst long name — the 8-char target is met, not just recorded.
});

test('p1 G4b: the heading flex keeps the name growing while the billing badge never shrinks', () => {
  const nameRule = cssRule(styles, '.customer-card-name');
  assert.match(nameRule, /flex:\s*1 1 auto/, 'the name grows into the heading space');
  const billingRule = cssRule(styles, '.customer-card-heading .customer-billing-badge');
  assert.ok(billingRule, 'the heading billing-badge rule exists');
  assert.match(billingRule, /flex-shrink:\s*0/, 'the "Paid · PKR 1,000/mo" badge never shrinks');
});

test('p1 G4c: the meta line still ellipsizes to one line (the Lifetime segment may hide on narrow cards — disclosed)', () => {
  const line = cssRule(styles, '.customer-card-meta-line');
  assert.match(line, /display:\s*block/, 'the meta line is a block');
  assert.match(line, /overflow:\s*hidden/, 'the meta line truncates');
  assert.match(line, /text-overflow:\s*ellipsis/, 'the meta line ellipsizes');
  assert.match(line, /white-space:\s*nowrap/, 'the meta line is one line always');
  const strip = cssRule(styles, '.customer-card-meta-line .customer-card-lifetime-pill');
  assert.ok(strip, 'the meta-line Lifetime strip exists');
  assert.match(strip, /background:\s*transparent/, 'the Lifetime pill reads as plain text on the line');
});

test('p1 G4d: pills stay >= 11px (D5 — no pill was shrunk to reach the name target)', () => {
  for (const sel of ['.customer-card-lifetime-pill', '.customer-card-tenure-pill', '.customer-card-health-pill']) {
    const rule = cssRule(styles, sel);
    assert.ok(rule, `${sel} rule exists`);
    assert.match(rule, /font-size:\s*11px/, `${sel} stays 11px`);
  }
  const idPill = cssRule(styles, '.customer-card-heading .customer-id-pill');
  assert.match(idPill, /font-size:\s*11px/, 'the #N pill stays 11px');
});

// ---------- G5 — stamp + cache-bust (10) ----------

test('p1 G5a: the top bar renders a d23 stamp (D3 — dist stays 23)', () => {
  assert.ok(indexHtml.includes('<span class="build-stamp" aria-hidden="true">d23</span>'), 'the top bar carries the d23 stamp after the brand mark');
  assert.ok(!indexHtml.includes('d24'), 'no d24 stamp anywhere (the spec\'s literal d24 was re-decided)');
  assert.ok(!/dist24/.test(indexHtml + swSource), 'no ?v=dist24 anywhere');
});

test('p1 G5b: the stamp is 9px, blessed (D12 — DS-0-badge precedent)', () => {
  const stamp = cssRule(styles, '.build-stamp');
  assert.ok(stamp, 'the .build-stamp rule exists');
  assert.match(stamp, /font-size:\s*9px/, 'the stamp is 9px');
  assert.match(stamp, /font-weight:\s*700/, 'the stamp is bold');
  assert.match(stamp, /opacity:\s*0\.65/, 'the stamp is muted, not a content label');
  // 9px is a non-content build label, the same precedent as the DS-0
  // bottom-nav badge (10px) — excepted in the Sharafat 97 sweep with
  // this guard test, not by loosening the floor.
});

test('p1 G5c: APP_VERSION stays 1.11.0 (frozen) and the build gate still pins dist 23', () => {
  const m = releaseAssurance.match(/APP_VERSION\s*=\s*'([^']+)'/);
  assert.ok(m, 'APP_VERSION exists in release-assurance.js');
  assert.equal(m[1], '1.11.0', 'APP_VERSION is frozen at 1.11.0');
  assert.ok(!/dist24/.test(read('build.mjs')), 'build.mjs carries no dist24');
});

test('p1 G5d: 688 — swUpdateVersionFromCacheName derives swu-<hash10> from a stamped cache name', () => {
  assert.equal(swUpdateVersionFromCacheName('shahdara-isp-billing-v37-a1b2c3d4e5'), 'swu-a1b2c3d4e5', 'a stamped cache name yields the hash identity');
  assert.equal(swUpdateVersionFromCacheName('shahdara-isp-billing-v37-deadbeef01'), 'swu-deadbeef01', 'another 10-char hash yields its identity');
  assert.equal(swUpdateVersionFromCacheName('shahdara-isp-billing-v37'), '', 'an unstamped dev worker has no hash identity');
  assert.equal(swUpdateVersionFromCacheName(''), '', 'empty cache name yields no identity');
  assert.equal(swUpdateVersionFromCacheName(null), '', 'a missing cache name yields no identity');
  assert.equal(swUpdateVersionFromCacheName('shahdara-isp-billing-v37-ABCDEF0123'), '', 'an uppercase tail is not a sha256 hex identity');
});

test('p1 G5e: 688 — the frozen stamp constant equals APP_VERSION', () => {
  const m = releaseAssurance.match(/APP_VERSION\s*=\s*'([^']+)'/);
  assert.ok(m, 'APP_VERSION exists');
  assert.equal(SW_UPDATE_FROZEN_VERSION, m[1], 'the frozen-stamp constant tracks APP_VERSION (a future bump must update both)');
  assert.equal(SW_UPDATE_FROZEN_VERSION, '1.11.0', 'the frozen stamp is 1.11.0');
});

// ---------- 688 prompt-flow mocks (sw-update-prompt.test.js harness shape) ----------
function createMockStorage(initial = {}) {
  const store = new Map(Object.entries(initial));
  return {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, val) => store.set(key, String(val)),
    removeItem: (key) => store.delete(key),
    clear: () => store.clear(),
  };
}
function createMockWorker(scriptURL) {
  return { scriptURL, state: 'installed', messages: [], postMessage(message) { this.messages.push(message); } };
}
function createMockRegistration({ waiting = null } = {}) {
  return { waiting, installing: null, active: null, update: async () => {}, addEventListener: () => {} };
}
function createMockServiceWorker({ registration = null, controller = {} } = {}) {
  const listeners = new Map();
  return {
    controller,
    addEventListener(type, cb) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(cb);
    },
    dispatchMessage(data) {
      (listeners.get('message') || []).forEach((cb) => cb({ data }));
    },
    getRegistration: async () => registration,
  };
}
function createMockWindow({ serviceWorker = null, pending, registration } = {}) {
  const listeners = new Map();
  const win = {
    navigator: serviceWorker ? { serviceWorker } : {},
    location: { reloads: 0, reload() { this.reloads += 1; } },
    addEventListener(type, cb) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(cb);
    },
    dispatchEvent(evt) {
      (listeners.get(evt.type) || []).forEach((cb) => cb(evt));
      return true;
    },
  };
  if (pending !== undefined) win.__swUpdatePending = pending;
  if (registration !== undefined) win.__swUpdateRegistration = registration;
  return win;
}
function createToastRecorder() {
  const calls = [];
  return { calls, onToast: (msg, opts) => { calls.push({ msg, opts }); } };
}
const FROZEN_URL = 'https://offerpk.github.io/shahdara-isp-billing/sw.js?v=1.11.0';
const V2_URL = 'https://offerpk.github.io/shahdara-isp-billing/sw.js?v=2.0.0';

test('p1 G5f: 688 — a frozen-stamp signal asks the waiting worker (SW_GET_STATUS) and defers', () => {
  const worker = createMockWorker(FROZEN_URL);
  const registration = createMockRegistration({ waiting: worker });
  const serviceWorker = createMockServiceWorker({ registration });
  const storage = createMockStorage();
  const win = createMockWindow({
    serviceWorker,
    pending: { scriptURL: worker.scriptURL, hasController: true },
    registration,
  });
  const recorder = createToastRecorder();
  setupSwUpdatePrompt({ win, storage, onToast: recorder.onToast });
  win.dispatchEvent({ type: SW_UPDATE_EVENT, detail: { scriptURL: worker.scriptURL, hasController: true } });
  assert.equal(recorder.calls.length, 0, 'no toast while the hash identity is unresolved');
  assert.deepEqual(worker.messages, [{ type: 'SW_GET_STATUS' }], 'the waiting worker is asked for its cache name');
  assert.equal(storage.getItem(SW_UPDATE_SHOWN_KEY), null, 'nothing is marked shown on the deferred path');
});

test('p1 G5g: 688 — the SW_STATUS reply re-considers with the hash identity and shows once per deploy', () => {
  const worker = createMockWorker(FROZEN_URL);
  const registration = createMockRegistration({ waiting: worker });
  const serviceWorker = createMockServiceWorker({ registration });
  const storage = createMockStorage();
  const win = createMockWindow({
    serviceWorker,
    pending: { scriptURL: worker.scriptURL, hasController: true },
    registration,
  });
  const recorder = createToastRecorder();
  setupSwUpdatePrompt({ win, storage, onToast: recorder.onToast });
  win.dispatchEvent({ type: SW_UPDATE_EVENT, detail: { scriptURL: worker.scriptURL, hasController: true } });
  assert.equal(recorder.calls.length, 0, 'deferred while the hash is unresolved');
  // The worker answers with its cache name (data.cache is the field
  // sw.js posts on SW_STATUS).
  serviceWorker.dispatchMessage({ type: 'SW_STATUS', cache: 'shahdara-isp-billing-v37-a1b2c3d4e5' });
  assert.equal(recorder.calls.length, 1, 'the toast shows once the hash identity resolves');
  assert.equal(storage.getItem(SW_UPDATE_SHOWN_KEY), 'swu-a1b2c3d4e5', 'the shown record is the hash identity, not 1.11.0');
  // The same deploy never prompts twice.
  serviceWorker.dispatchMessage({ type: 'SW_STATUS', cache: 'shahdara-isp-billing-v37-a1b2c3d4e5' });
  assert.equal(recorder.calls.length, 1, 'the same deploy never prompts twice');
  // The next deploy prompts again (a new hash is a new identity).
  serviceWorker.dispatchMessage({ type: 'SW_STATUS', cache: 'shahdara-isp-billing-v37-f6e5d4c3b2' });
  assert.equal(recorder.calls.length, 2, 'the next deploy prompts again');
});

test('p1 G5h: 688 — a non-frozen scriptURL version is used as-is (existing behaviour, pinned)', () => {
  const worker = createMockWorker(V2_URL);
  const registration = createMockRegistration({ waiting: worker });
  const serviceWorker = createMockServiceWorker({ registration });
  const storage = createMockStorage();
  const win = createMockWindow({
    serviceWorker,
    pending: { scriptURL: worker.scriptURL, hasController: true },
    registration,
  });
  const recorder = createToastRecorder();
  setupSwUpdatePrompt({ win, storage, onToast: recorder.onToast });
  win.dispatchEvent({ type: SW_UPDATE_EVENT, detail: { scriptURL: worker.scriptURL, hasController: true } });
  assert.equal(recorder.calls.length, 1, 'a real scriptURL version prompts at once');
  assert.deepEqual(worker.messages, [], 'no SW_GET_STATUS ask when the stamp is a real version');
  assert.equal(storage.getItem(SW_UPDATE_SHOWN_KEY), '2.0.0', 'the shown record is the scriptURL version');
});

// ---------- 690 service-worker harness (service-worker.test.js shape) ----------
class MockResponse {
  constructor(body, init = {}) { this.body = body; this.status = init.status ?? 200; this.ok = this.status >= 200 && this.status < 300; }
}
function createSwWorker({ entries = [] } = {}) {
  const origin = 'https://billing.example';
  const handlers = new Map();
  const names = new Set(['shahdara-isp-billing-v37']);
  const stored = new Map([['shahdara-isp-billing-v37', new Map()]]);
  const urlFor = (request) => new URL(typeof request === 'string' ? request : request.url, `${origin}/`);
  for (const [path, value] of entries) stored.get('shahdara-isp-billing-v37').set(urlFor(path).pathname, value);
  const fetched = [];
  const matchOptions = [];
  let fetchImpl = async () => { throw new Error('offline'); };
  const cacheFor = (name) => ({
    addAll: async () => {},
    put: async (request, response) => { stored.get(name).set(urlFor(request).pathname, response); },
  });
  const caches = {
    open: async (name) => cacheFor(name),
    keys: async () => [...names],
    delete: async (name) => { stored.delete(name); return names.delete(name); },
    match: async (request, options = {}) => {
      matchOptions.push(options);
      return stored.get('shahdara-isp-billing-v37')?.get(urlFor(request).pathname);
    },
  };
  const self = {
    location: { origin },
    addEventListener: (type, cb) => handlers.set(type, cb),
    skipWaiting: () => Promise.resolve(),
    clients: { claim: () => Promise.resolve() },
  };
  runInNewContext(swSource, { self, caches, fetch: (request) => fetchImpl(request), URL, Promise, Response: MockResponse });
  return {
    fetched,
    matchOptions,
    setFetch: (fn) => { fetchImpl = fn; },
    async dispatchFetch(request) {
      let responsePromise;
      let responded = false;
      const event = { request, respondWith: (p) => { responded = true; responsePromise = Promise.resolve(p); } };
      handlers.get('fetch')(event);
      return { responded, response: responded ? await responsePromise : undefined };
    },
  };
}

test('p1 G5i: 690 — a versioned asset request goes network-first; the cache is the offline fallback', async () => {
  const worker = createSwWorker({
    entries: [['/app.js', 'cached module'], ['/styles.css', 'cached styles']],
  });
  const fresh = { ok: true, status: 200, type: 'basic', body: 'fresh module', clone() { return this; } };
  worker.setFetch(async (request) => { worker.fetched.push(request.url); return fresh; });
  const online = await worker.dispatchFetch({ url: 'https://billing.example/app.js?v=1.11.0', method: 'GET' });
  assert.equal(online.responded, true, 'the versioned request is answered');
  assert.equal(online.response, fresh, 'online, a versioned asset comes from the network first');
  assert.deepEqual(worker.fetched, ['https://billing.example/app.js?v=1.11.0'], 'the network was tried before the cache');
  // Offline: the network fails, the cached copy answers (any stamp —
  // the content is the same file). A different URL is used here so
  // the online fetch's cache.put cannot mask the cached entry.
  worker.setFetch(async () => { throw new Error('offline'); });
  const offline = await worker.dispatchFetch({ url: 'https://billing.example/styles.css?v=1.11.0', method: 'GET' });
  assert.equal(offline.response, 'cached styles', 'offline, the cached copy is the fallback');
  assert.equal(worker.matchOptions[0].ignoreSearch, true, 'the offline fallback still matches ignoring the query');
});

test('p1 G5j: 690 — an unversioned asset request stays cache-first (offline-first preserved)', async () => {
  const worker = createSwWorker({ entries: [['/app.js', 'cached module']] });
  worker.setFetch(async (request) => { worker.fetched.push(request.url); return { ok: true, status: 200, type: 'basic', clone() { return this; } }; });
  const res = await worker.dispatchFetch({ url: 'https://billing.example/app.js', method: 'GET' });
  assert.equal(res.responded, true, 'the unversioned request is answered');
  assert.equal(res.response, 'cached module', 'an unversioned asset is served from the cache');
  assert.deepEqual(worker.fetched, [], 'the network is not tried for an unversioned asset');
});
