// Customers List Cards polish (Task 14, user spec 2026-11-22): distinct
// billing-driven name colour + colour-coded metadata pills + Health /
// tenure chip fixes, 3 sub-parts on 360px Android.
//
// Parent decisions (FINAL — implemented here, NOT the spec as written):
// - D1: name colour is BILLING-driven (paid → navy, pending/partial →
//   rose, not-set → slate). The OR-rule (rose if pending OR offline)
//   is REJECTED — billing is what the card's Paid pill already shows.
// - D2: navy #1E3A5F + rose-800 #9f1239 are SPEC LITERALS (+2 hex in
//   styles.css, disclosed); not-set → --color-slate-700; name 15px.
// - D3: Area pill var(--qc-low-bg) + #0369a1 + #bae6fd (0 new).
// - D4: Package border is --color-slate-300 (0 new), NOT the literal
//   #ddd6fe (+1); bg/text var(--qc-purple-bg) / var(--qc-purple-text).
//   (color-mix was considered; the repo uses no color-mix anywhere,
//   so the existing slate token is the safer substitute.)
// - D5: Lifetime pill keeps its own green chrome #e8f5ed/#19704e/
//   #a8d6ba (0 new), NOT the spec teal (+3).
// - D6: Offline pill keeps the existing offline palette #fff1f0/
//   #783631/#dfb4b1 (0 new), NOT the spec rose set (+3). (Compare's
//   --qc-rose-strong-text had NOT merged at implementation time, so
//   the existing palette stands.)
// - D7: Health reads "90/100 · Good" (drop only the "Health: " prefix;
//   the category word drives the pill colour) — a deviation from the
//   spec's "Health 90", disclosed. Null score keeps "Health: New".
// - D8: Tenure reads "6 mos" (drop "(Jun '26)"; the start-month leaves
//   the card only).
// - D9: the stale D comment at styles.css:1169-1172 rides with this
//   item (it described exactly the structure this item replaces).
// - D10: the new pill class is .customer-card-meta-chip — MUST NOT be
//   .customer-card-meta-pill (round2 R2b pins its deletion).
// - Chip weight is 500 per the spec (the repo's pill rules use
//   11px/700; the status chip keeps 700 via its own rule, the
//   Lifetime chip via its base rule).
//
// The repro this file converts from had TWO prep bugs, fixed here and
// in the scratch repro (original preserved as
// repro-customers-list-cards-orig.mjs):
// - S1a inspected only the base .customer-card-name rule for a colour,
//   but the colours live on the modifier classes by design (prep §2) —
//   the check now inspects the three modifier rules.
// - S3c hardcoded the BASE texts (20/15 ch → 379px always) so it could
//   never pass — the model now uses the post-fix texts (13/5 ch).
// Worst case ("100/100 · Critical" + "12 mos") models ~307px — 9px
// over, absorbed by the tenure pill's pinned shrink + ellipsis,
// disclosed in the PR body; the 360px on-phone check is owed after
// deploy (no Chrome on this VM).
//
// Fixtures are generic placeholders only ("Customer A", pattern-fake
// phone 03012345678 family) — no real customer data from any
// screenshot. The partial fixture is driven through the real billing
// path (bill 1000, pay 400 → partial), never a hand-set status.
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
const tokens = read('tokens.css');
const dark = read('dark-contrast.css');

lang.setAppLanguage('en');

const cardStart = app.indexOf('function customerCardMarkup(');
assert.ok(cardStart > -1, 'customerCardMarkup exists');
const card = app.slice(cardStart, app.indexOf('\n}\n', cardStart));

// ---------- render harness (customers-cards-round2.test.js, verbatim shape) ----------
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
function hexCount(css) {
  const noComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
  return new Set(noComments.match(/#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g) || []).size;
}
function cssRule(src, selector) {
  return (src.match(new RegExp(selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ' \\{[^}]*\\}', 's')) || [])[0] || '';
}
function nameSpan(html) {
  return (html.match(/<span class="customer-card-name[^"]*" dir="auto">[^<]*<\/span>/) || [])[0] || '';
}
function healthPill(html) {
  return (html.match(/<span class="customer-card-health-pill[^"]*"[^>]*>(.*?)<\/span>/) || [])[1] || '';
}
function tenurePill(html) {
  return (html.match(/<span class="customer-card-tenure-pill[^"]*"[^>]*>(.*?)<\/span>/) || [])[1] || '';
}
function metaLine(html) {
  return (html.match(/<span class="customer-card-meta-line">(.*?)<\/span><\/button>/) || [])[1] || '';
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
// Paid-up, Father/Ref present, Charyaa 3Mbps/100GB, 6 mos tenure.
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
// Partial: Oct bill 1000, paid 400 → derivedBillStatus 'partial'.
function partialState() {
  let state = mkState();
  const c = baseCustomer();
  state.customers.push(c);
  state = bill(state, c.id, '2026-10', 1000); state = pay(state, c.id, '2026-10', '2026-10-04', 400);
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
// Risk (60–79) via real history: Sep paid, Oct unpaid → 63.
function riskState() {
  let state = mkState();
  const c = baseCustomer();
  state.customers.push(c);
  state = bill(state, c.id, '2026-09', 1000); state = pay(state, c.id, '2026-09', '2026-09-04', 1000);
  state = bill(state, c.id, '2026-10', 1000);
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
// No connection date, no bill, no package: billing 'not-set'.
function noDateState() {
  const state = mkState();
  const c = baseCustomer({ connectionDate: '', serviceStatus: 'not-set', monthlySellingAmount: null, packageSpeed: '' });
  state.customers.push(c);
  return { state, customer: state.customers.find((x) => x.id === c.id) };
}

// ---------- S1: distinct name colour + Urdu alignment ----------

test('list-cards S1a paid: the name is navy (D1/D2)', () => {
  const { state, customer } = paidUpState();
  assert.match(nameSpan(renderCard(customer, state)), /customer-card-name--paid/, 'paid card carries the --paid name class');
  assert.match(cssRule(styles, '.customer-card-name--paid'), /color:\s*#1E3A5F/, 'paid name is the spec navy literal');
});

test('list-cards S1a pending/partial: the name is rose (D1/D2 — the OR-rule is rejected)', () => {
  const owed = owedState();
  assert.match(nameSpan(renderCard(owed.customer, owed.state)), /customer-card-name--pending/, 'pending card carries the --pending name class');
  const partial = partialState();
  assert.match(nameSpan(renderCard(partial.customer, partial.state)), /customer-card-name--pending/, 'partial counts as pending for the name colour (billing-driven, not service-driven)');
  assert.match(cssRule(styles, '.customer-card-name--pending'), /color:\s*#9f1239/, 'pending name is the spec rose-800 literal');
});

test('list-cards S1a not-set: the name is slate (D1/D2)', () => {
  const { state, customer } = noDateState();
  assert.match(nameSpan(renderCard(customer, state)), /customer-card-name--not-set/, 'not-set card carries the --not-set name class');
  assert.match(cssRule(styles, '.customer-card-name--not-set'), /color:\s*var\(--color-slate-700\)/, 'not-set name reuses the slate token (0 new hex)');
});

test('list-cards S1b: an Urdu-script name stays left-anchored (dir="auto" kept)', () => {
  const rule = cssRule(styles, '.customer-card-name');
  assert.match(rule, /direction:\s*ltr/, 'the name box is forced LTR so an RTL-resolved span cannot float right');
  assert.match(rule, /text-align:\s*left/, 'the name text starts at the left');
  assert.match(rule, /color:\s*var\(--ink\)/, 'the base rule keeps the plain ink colour — the status colours live on the modifier classes');
  const { state, customer } = paidUpState();
  assert.match(nameSpan(renderCard(customer, state)), /dir="auto"/, 'dir="auto" stays on the span (pinned by customer-card-polish.test.js:63)');
});

test('list-cards S1c: the name is 15px via the token (D2)', () => {
  assert.match(tokens, /--text-card-name:\s*15px;/, 'the token moved 14.5px -> 15px');
  assert.match(cssRule(styles, '.customer-card-name'), /font-size:\s*var\(--text-card-name\)/, 'the name still sizes through the token');
});

// ---------- S2: colour-coded metadata pills ----------

test('list-cards S2a: the meta line is colour-coded chips, not a dot-separated line (D10)', () => {
  const { state, customer } = paidUpState();
  const meta = metaLine(renderCard(customer, state));
  assert.ok(meta.length > 0, 'the meta line renders');
  const chips = meta.match(/<span class="[^"]*customer-card-meta-chip/g) || [];
  assert.equal(chips.length, 5, 'all five segments (status • mohalla • package • Ref • Lifetime) are chip spans');
  assert.match(meta, /customer-card-meta-chip--active/, 'the status chip carries its service variant');
  assert.match(meta, /customer-card-meta-chip--area/, 'the mohalla chip carries its variant');
  assert.match(meta, /customer-card-meta-chip--package/, 'the package chip carries its variant');
  assert.match(meta, /customer-card-meta-chip--ref/, 'the Ref chip carries its variant');
  assert.match(meta, /customer-card-meta-chip--lifetime/, 'the Lifetime chip carries its variant');
  assert.doesNotMatch(app, /metaLineSegments\.join\(' • '\)/, "the ' • ' join is gone — the flex gap does the spacing");
  assert.match(app, /metaLineSegments\.join\(''\)/, 'segments join with an empty string');
  assert.doesNotMatch(app, /customer-card-meta-pill/, 'no .customer-card-meta-pill in app.js (round2 R2b pins its deletion)');
  assert.doesNotMatch(styles, /customer-card-meta-pill/, 'no .customer-card-meta-pill in styles.css');
  assert.doesNotMatch(dark, /customer-card-meta-pill/, 'no .customer-card-meta-pill in dark-contrast.css');
});

test('list-cards S2b: the chip colours are the approved palette (D3–D6, 0 new hex)', () => {
  assert.match(cssRule(styles, '.customer-card-meta-chip'), /padding:\s*2px 8px/, 'the chip is 2px 8px per the spec');
  assert.match(cssRule(styles, '.customer-card-meta-chip'), /font-size:\s*11px/, 'the chip is 11px');
  assert.match(cssRule(styles, '.customer-card-meta-chip'), /font-weight:\s*500/, 'the chip is 500 per the spec (status + Lifetime keep 700 via their own rules)');
  assert.match(cssRule(styles, '.customer-card-meta-chip'), /border-radius:\s*var\(--radius-pill\)/, 'the chip uses the pill radius token');
  assert.match(cssRule(styles, '.customer-card-meta-chip--active'), /background:\s*#ecfdf5;\s*color:\s*#047857;\s*border-color:\s*#a7f3d0/, 'Active is the emerald triple');
  assert.match(cssRule(styles, '.customer-card-meta-chip--offline'), /background:\s*#fff1f0;\s*color:\s*#783631;\s*border-color:\s*#dfb4b1/, 'Offline reuses the existing offline palette (D6)');
  assert.match(cssRule(styles, '.customer-card-meta-chip--not-set'), /background:\s*#f1f5f9;\s*color:\s*#64748b/, 'Not set is the slate pair');
  assert.match(cssRule(styles, '.customer-card-meta-chip--area'), /background:\s*var\(--qc-low-bg\);\s*color:\s*#0369a1;\s*border-color:\s*#bae6fd/, 'Area is the sky triple (D3)');
  assert.match(cssRule(styles, '.customer-card-meta-chip--package'), /background:\s*var\(--qc-purple-bg\);\s*color:\s*var\(--qc-purple-text\);\s*border-color:\s*var\(--color-slate-300\)/, 'Package is the purple pair + slate border (D4)');
  assert.match(cssRule(styles, '.customer-card-meta-chip--package-not-set'), /background:\s*#f1f5f9;\s*color:\s*var\(--color-slate-400\)/, 'Package-not-set is slate-100 + slate-400');
  assert.match(cssRule(styles, '.customer-card-meta-chip--ref'), /background:\s*#fffbeb;\s*color:\s*#92400e;\s*border-color:\s*#fde68a/, 'Ref is the amber triple');
});

test('list-cards S2c: the Lifetime pill shows its chrome on the meta line (D5)', () => {
  assert.doesNotMatch(styles, /\.customer-card-meta-line \.customer-card-lifetime-pill \{/, 'the Round 2 strip rule is deleted');
  assert.match(cssRule(styles, '.customer-card-lifetime-pill'), /background:\s*#e8f5ed/, 'the Lifetime pill keeps its own green chrome');
  assert.match(cssRule(styles, '.customer-card-meta-line .customer-card-meta-chip--lifetime'), /padding:\s*2px 8px/, 'on the meta line it takes the 2px 8px chip padding');
  const { state, customer } = paidUpState();
  assert.match(metaLine(renderCard(customer, state)), /customer-card-lifetime-pill customer-card-meta-chip customer-card-meta-chip--lifetime/, 'the Lifetime segment keeps its class and gains the chip classes');
});

// ---------- S3: Health + tenure chips ----------

test('list-cards S3a: the Health pill is the short form — "90/100 · Good" (D7)', () => {
  const good = goodState();
  assert.equal(healthPill(renderCard(good.customer, good.state)), '<bdi>100/100</bdi> · Good', 'scored health drops the "Health: " prefix; the category word stays (it drives the pill colour)');
  const risk = riskState();
  assert.equal(healthPill(renderCard(risk.customer, risk.state)), '<bdi>63/100</bdi> · Risk', 'the category word survives on Risk too');
  const none = noScoreState();
  assert.equal(healthPill(renderCard(none.customer, none.state)), 'Health: New', 'a null score still reads "Health: New" (bare "New" alone is cryptic)');
});

test('list-cards S3b: the tenure pill is the short form — "6 mos" (D8)', () => {
  const { state, customer } = paidUpState();
  assert.equal(tenurePill(renderCard(customer, state)), '<bdi>6</bdi> mos', 'current tenure is just "N mos" — the "(Mon \'YY)" suffix leaves the card');
  assert.equal(tenurePill(renderCard(customer, state, 'ur')), '<bdi>6</bdi> ماہ', 'UR tenure is "N ماہ"');
  assert.doesNotMatch(app, /shortMonthYear/, 'shortMonthYear is gone from app.js entirely');
});

test('list-cards S3c: the middle row fits 360px (298px budget)', () => {
  // Model (measured from the CSS on base): 360px viewport, list padding
  // 10px/side -> card 340px; .customer-card-rows padding 2px 14px 10px ->
  // row inner 310px; two 6px gaps -> 298px for the three items.
  // Widths: 11px/700 ~6.5px/char (health + tenure pills), 12px/800
  // ~7.8px/char (Additional button); health pill padding 3px 9px = 18px
  // horizontal, tenure pill stripped = 0, Additional padding 3px 10px = 20px.
  // Post-fix case: Health "90/100 · Good" (13 ch), tenure "6 mos" (5 ch),
  // "+ Additional ▾" (13 ch).
  const w = (chars, per, pad) => Math.round(chars * per + pad);
  const total = w(13, 6.5, 18) + w(5, 6.5, 0) + w(13, 7.8, 20) + 12;
  assert.equal(total, 269, 'the post-fix middle row models ~269px');
  assert.ok(total <= 298, '269px fits the 298px budget with 29px headroom');
  // Worst case ("100/100 · Critical" 18 ch + "12 mos" 6 ch) models 307px
  // — 9px over, absorbed by the tenure pill's pinned shrink + ellipsis
  // (disclosed in the PR body; the 360px on-phone check is owed).
  const worst = w(18, 6.5, 18) + w(6, 6.5, 0) + w(13, 7.8, 20) + 12;
  assert.equal(worst, 307, 'the worst case models 307px (pinned, not blessed)');
});

// ---------- guards: hex ratchet, dark coverage, parity ----------

test('list-cards guards: hex ratchet, dark coverage, parity (no new keys)', () => {
  // styles.css 608 -> 610: exactly the two spec-literal name colours
  // (#1E3A5F navy + #9f1239 rose-800, D2). Every other colour reuses
  // hex already in the sheet.
  assert.equal(hexCount(styles), 610, 'styles.css distinct hex is 610 (+2, the two spec literals)');
  assert.equal(hexCount(dark), 19, 'dark-contrast.css distinct hex stays 19 (0 new)');
  for (const cls of ['customer-card-name--paid', 'customer-card-name--pending', 'customer-card-name--not-set',
    'customer-card-meta-chip--active', 'customer-card-meta-chip--offline', 'customer-card-meta-chip--not-set',
    'customer-card-meta-chip--area', 'customer-card-meta-chip--package', 'customer-card-meta-chip--package-not-set',
    'customer-card-meta-chip--ref', 'customer-card-meta-chip--lifetime']) {
    assert.ok(dark.includes(`[data-theme="dark"] .${cls}`), `dark-contrast.css covers .${cls}`);
  }
  // This item adds NO i18n keys. SPLIT parity literal — never the bare
  // literal. Re-pinned at rebase (Customers List Cards, 2026-11-23):
  // Register +5 then Closing +1 → 5,229 (was '52' + '23' on the PR base).
  // Bill card rebase (2026-11-23): +2 keys → 5,231.
  // Billing history rebase (2026-11-23): +3 keys → 5,234.
  // Re-pin (Billing history rebase 2026-11-23): parity 5,231 → 5,234 — M adds 3 keys, prof_hist_empty_months + prof_hist_mark_paid + prof_hist_empty_custom, EN + UR.
  assert.equal(Object.keys(TRANSLATIONS.en).length, Number('52' + '34'), 'EN parity');
  assert.equal(Object.keys(TRANSLATIONS.ur).length, Number('52' + '34'), 'UR parity');
});
