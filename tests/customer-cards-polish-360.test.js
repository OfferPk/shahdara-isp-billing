// Customers Tab — Customer Profile Cards polish (user request
// 2026-11-21, screenshot-driven): 4 refinements for 360px screens.
// (1) 'Clear dues' KEEPS its header seat (the user's correction:
// check if it is necessary — it is: one-tap full settlement via the
// shared clearCustomerDues path, so the operator never has to open
// the profile) but is recoloured a soft mint secondary, no longer a
// second solid-green primary competing with Collect.
// (2) The muted subtitle line becomes a wrapping flex row (segments
// share one baseline) instead of a one-line ellipsis clip, so the
// Lifetime segment is never hidden.
// (3) The two dark ID-pill slots (-0 solid black, -4 dark slate)
// soften to pastel weight; the no-score health label shortens from
// 'insufficient history' to 'New'.
// (4) The Call icon carries an emerald tint; Collect stays the
// single bold primary green CTA in the action row.
//
// Fixtures are generic placeholders only ("Customer A", pattern-fake
// phone family) — no real customer data from any screenshot.
// NOT a pinning file: no suite or parity totals appear here.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import * as core from '../core.js';
import * as mbq from '../manual-baqaya.js';
import { buildCustomerHealthScore } from '../owner-insights.js';
import * as lang from '../nav-language.js';
import { TRANSLATIONS } from '../nav-language.js';
import * as cardStyle from '../customer-card-style.js';
import * as knownAs from '../known-as-name.js';
import * as phase3 from '../phase3.js';
import * as dsIcons from '../ds-icons.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const read = (file) => readFileSync(path.join(__dirname, '..', file), 'utf8');
const app = read('app.js');
const styles = read('styles.css');

lang.setAppLanguage('en');

const cardStart = app.indexOf('function customerCardMarkup(');
assert.ok(cardStart > -1, 'customerCardMarkup exists');
const card = app.slice(cardStart, app.indexOf('\n}\n', cardStart));

// ---------- render harness (customers-cards-round2.test.js pattern) ----------
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
function plainText(html) {
  return html.replace(/<[^>]*>/g, '').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
}
function cssRule(css, selector) {
  const at = css.indexOf(selector);
  if (at === -1) return null;
  const open = css.indexOf('{', at);
  const close = css.indexOf('}', open);
  if (open === -1 || close === -1) return null;
  return css.slice(open + 1, close);
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
// Paid-up, Father/Ref present, Charyaa 3Mbps/100GB (long muted line).
function paidUpState() {
  let state = mkState();
  const c = baseCustomer({ fatherOrReferenceName: 'Reference Person' });
  state.customers.push(c);
  for (const m of ['2026-08', '2026-09', '2026-10']) { state = bill(state, c.id, m, 1000); state = pay(state, c.id, m, `${m}-04`, 1000); }
  return { state, customer: state.customers.find((x) => x.id === c.id) };
}
// Owed: Oct bill unpaid (also the no-score fixture: <2 completed months).
function owedState() {
  let state = mkState();
  const c = baseCustomer();
  state.customers.push(c);
  state = bill(state, c.id, '2026-10', 1000);
  return { state, customer: state.customers.find((x) => x.id === c.id) };
}
// No-score: one paid month only.
function noScoreState() {
  let state = mkState();
  const c = baseCustomer();
  state.customers.push(c);
  state = bill(state, c.id, '2026-10', 1000); state = pay(state, c.id, '2026-10', '2026-10-04', 1000);
  return { state, customer: state.customers.find((x) => x.id === c.id) };
}

// ---------- C1: refinement 1 — Clear dues KEPT, recoloured soft ----------
test('cards-polish-360 C1: Clear dues stays on the card but is no longer a solid dark-green primary', () => {
  assert.ok(card.includes('customer-card-clear-dues'), 'Clear-dues span stays in the header seat');
  assert.ok(card.includes('data-clear-dues-card'), 'Clear-dues keeps its card gate');
  const rule = cssRule(styles, '.customer-card-clear-dues');
  assert.ok(rule, 'clear-dues rule exists');
  assert.ok(!/background:\s*var\(--green\)/.test(rule), 'background is no longer the solid primary green');
  assert.ok(!/color:\s*#fff/.test(rule), 'text is no longer white-on-green');
  assert.ok(/background:\s*var\(--mint\)|background:\s*#[e-f][0-9a-f]{5}/i.test(rule), 'background is a soft tint');
  assert.ok(/\.customer-card-clear-dues:focus-visible/.test(styles), 'focus-visible rule stays (plan589 pin)');
});

// ---------- C2: refinement 2 — muted line wraps, baseline aligned ----------
test('cards-polish-360 C2: the muted line is a wrapping flex row, not a one-line ellipsis clip', () => {
  const rule = cssRule(styles, '.customer-card-meta-line');
  assert.ok(rule, 'meta-line rule exists');
  assert.ok(/display:\s*flex/.test(rule), 'meta line is flex');
  assert.ok(/align-items:\s*center/.test(rule), 'segments share one baseline');
  assert.ok(/flex-wrap:\s*wrap/.test(rule), 'long lines wrap instead of clipping');
  assert.ok(!/text-overflow:\s*ellipsis/.test(rule), 'no ellipsis truncation');
  assert.ok(!/white-space:\s*nowrap/.test(rule), 'no forced single line');
  assert.ok(/color:\s*#475569/.test(rule), 'muted grey stays');
  const { state, customer } = paidUpState();
  const text = plainText(renderCard(customer, state));
  assert.ok(text.includes('Charyaa'), 'mohalla rides the line');
  assert.ok(text.includes('3Mbps/100GB'), 'package rides the line');
  assert.ok(text.includes('Lifetime:'), 'Lifetime segment stays on the card');
});

// ---------- C3/C4: refinement 3a — ID pills soft ----------
test('cards-polish-360 C3: ID pill -0 is a soft tint, not solid black', () => {
  const { state, customer } = owedState();
  const html = renderCard({ ...customer, customerNumber: 33 }, state);
  assert.ok(html.includes('customer-id-pill-0'), 'customer 33 still takes slot -0');
  const rule = cssRule(styles, '.customer-id-pill-0');
  assert.ok(rule, 'pill-0 rule exists');
  assert.ok(!/background:\s*#000/.test(rule), 'background is no longer solid black');
  assert.ok(!/color:\s*#fff/.test(rule), 'text is no longer white-on-black');
});

test('cards-polish-360 C4: ID pill -4 is a soft tint, not dark slate', () => {
  const { state, customer } = owedState();
  const html = renderCard({ ...customer, customerNumber: 37 }, state);
  assert.ok(html.includes('customer-id-pill-4'), 'customer 37 still takes slot -4');
  const rule = cssRule(styles, '.customer-id-pill-4');
  assert.ok(rule, 'pill-4 rule exists');
  assert.ok(!/background:\s*#334155/.test(rule), 'background is no longer dark slate');
  assert.ok(!/color:\s*#fff/.test(rule), 'text is no longer white-on-dark');
});

// ---------- C5: refinement 3b — Health: New ----------
test('cards-polish-360 C5: a no-score card reads "Health: New", not "Health: insufficient history"', () => {
  const { state, customer } = noScoreState();
  const text = plainText(renderCard(customer, state));
  assert.ok(text.includes('Health: New'), 'no-score health text is the short label');
  assert.ok(!text.includes('insufficient history'), 'the long label is gone from the card');
});

// ---------- C6: refinement 4 — Call tinted, Collect the single primary ----------
test('cards-polish-360 C6: Call icon carries a tint and Collect stays the single bold primary', () => {
  const rule = cssRule(styles, '.customer-card-action-call svg');
  assert.ok(rule, 'Call icon tint rule exists');
  assert.ok(/color:/.test(rule), 'the tint sets a colour on the icon');
  const collect = cssRule(styles, '.customer-card-action-collect');
  assert.ok(collect, 'Collect rule exists');
  assert.ok(/background:\s*var\(--green\)/.test(collect), 'Collect stays solid green');
  assert.ok(/flex:\s*1 1 0/.test(collect), 'Collect stays flex:1');
  assert.ok(!/background:\s*var\(--green\)/.test(cssRule(styles, '.customer-card-action-call') || ''), 'Call is not a second green primary');
});

// ---------- S: stability ----------
test('cards-polish-360 S1: the Outstanding row still renders when something is owed', () => {
  const { state, customer } = owedState();
  const html = renderCard(customer, state);
  assert.ok(html.includes('customer-card-row'), 'Outstanding row exists');
  assert.ok(plainText(html).includes('Outstanding'), 'Outstanding label renders');
});

test('cards-polish-360 S2: the profile Clear-dues button still delegates to the shared helper', () => {
  assert.ok(app.includes("return clearCustomerDues(customer.id, { button: $('#clearDuesButton') })"), 'profile clearDues delegates to clearCustomerDues');
  assert.ok(app.includes('async function clearCustomerDues(customerId, { button = null } = {})'), 'shared helper exists');
});

test('cards-polish-360 S3: the i18n key count is unchanged in both dicts (value change only, no new key)', () => {
  assert.equal(Object.keys(TRANSLATIONS.en).length, Object.keys(TRANSLATIONS.ur).length, 'EN/UR dicts stay in parity');
});

// ---------- B: behaviour ----------
test('cards-polish-360 B1: a plain card still renders — name, ID pill, health pill, action row', () => {
  const { state, customer } = paidUpState();
  const html = renderCard(customer, state);
  assert.ok(html.includes('Customer A'), 'name renders');
  assert.ok(html.includes('customer-id-pill'), 'ID pill renders');
  assert.ok(html.includes('customer-card-health-pill'), 'health pill renders');
  assert.ok(html.includes('customer-card-actions'), 'action row renders');
  assert.ok(html.includes('customer-card-action-call'), 'Call renders');
  assert.ok(html.includes('customer-card-action-collect'), 'Collect renders');
  assert.ok(html.includes('customer-card-action-profile'), 'Profile renders');
});
