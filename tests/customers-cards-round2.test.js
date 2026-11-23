// Customers Directory Cards — ROUND 2 Ultra-Compact (user request
// 2026-11-17, screenshot-driven follow-up to Round 1): the ＋ Additional
// button becomes a 24px micro-pill on the health row; the two meta-pills
// become ONE muted text line; the tenure shortens to "N mos" (List Cards polish D8: the "(Mon 'YY)" suffix leaves the card)
// and hides when no connection date is set; the Health pill colours by
// CATEGORY (Risk → amber, Critical → rose); the action bar tightens to
// 36px with a "Profile" button (IdCard icon).
//
// Parent decisions D1–D12 (prep header) implemented here, NOT the spec
// as written:
// - D1: BOTH floor defeaters allowed (24px Additional + 36px actions)
//   in the 96-precedent !important shape, with why-comments naming the
//   USER's explicit request. Recorded, not blessed: 24px is below the
//   96 touch-target rationale — do not copy this pattern elsewhere.
// - D2a: the health row moves OUT of the outer <button> into
//   .customer-card-rows (real <button> kept; rows div is already a tap
//   target; manual-baqaya.js sync preserved).
// - D3a: ADDITIVE category classes on the card pill only
//   (.health-risk / .health-critical alongside the band class; the
//   helper + all pins untouched).
// - D4: colour by LABEL — 50–59 is labelled Critical, so it renders
//   rose (the user's "<50" differs — disclosed in the PR body).
// - D5: ✎ moves to the health row as a 24px ✎ micro-pill.
// - D6: the Profile icon reuses the existing IdCard (no new ds-icons
//   entry, no ds0 pin change).
// - D7: the muted line wraps as a flex row (Customers-tab polish —
//   the one-line ellipsis clip is gone, so Lifetime is never hidden).
// - D8: fresh .customer-card-meta-line class (gone-list untouched;
//   a new dark rule covers it).
// - D9: Profile in UR = 'پروفائل'; muted-line "Ref:" prefix in UR =
//   'حوالہ:'; AKA = 'AKA: …' EN / 'دیگر نام: …' UR; compact tenure in
//   UR = Latin "Jun '26"; cust_card_father_ref_short + 
//   cust_card_tenure_since_short deleted (their only production user
//   was the card); cust_card_alias_short + cust_card_tenure_months_short
//   kept (the new line still uses them).
// - D10: padding scope = outer button only (:964 + :1420); the rows
//   div padding stays.
// - D11: the GREEN ds-success pill is kept for ＋ Additional.
// - D12: Critical border #fecaca.
// - Honest geometry (prep §2, harness-measured): Round 1's "≈197px
//   common card" was WRONG — the real baseline is 260.3px. Round 2
//   does NOT reach 3 cards/viewport (~1.9 → ~2.2–2.5) — stated
//   plainly in the PR body.
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
const comp = read('components.css');
const dark = read('dark-contrast.css');

lang.setAppLanguage('en');

const cardStart = app.indexOf('function customerCardMarkup(');
assert.ok(cardStart > -1, 'customerCardMarkup exists');
const card = app.slice(cardStart, app.indexOf('\n}\n', cardStart));

// ---------- render harness (measure-base.mjs factory, verbatim shape) ----------
// app.js cannot be imported (module-scope DOM work), so the card is
// rendered by extracting customerCardMarkup + its helpers from source
// and evaluating them with the real core/manual-baqaya/insights
// helpers and the same stubs the measurement harness uses.
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
// Critical, 50–59 by label (D4): Aug paid, Sep + Oct unpaid → 50.
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
// No connection date: tenure status 'not-recorded'.
function noDateState() {
  const state = mkState();
  const c = baseCustomer({ connectionDate: '', serviceStatus: 'not-set', monthlySellingAmount: null, packageSpeed: '' });
  state.customers.push(c);
  return { state, customer: state.customers.find((x) => x.id === c.id) };
}

// ---------- R1 — health-row composition (5) ----------

test('r2 R1a: paid-up card composes ＋ Additional with the Health pill on ONE spread row', () => {
  const { state, customer } = paidUpState();
  const html = renderCard(customer, state);
  const row = healthRowHtml(html);
  assert.ok(row, 'health row exists on the paid-up card');
  assert.ok(row.includes('customer-card-health-pill'), 'health pill rides on the health row');
  assert.ok(row.includes('additional-pending-btn'), '＋ Additional rides on the SAME health row');
  assert.ok(row.includes('+ Additional ▾'), 'micro-pill label is "+ Additional ▾"');
  assert.ok(!html.includes('canAddPending && outstanding.totalCents === 0'), 'no paid-up row branch left in the card');
});

test('r2 R1b: owed card composes ＋ Additional with the Health pill; the Outstanding row carries no button', () => {
  const { state, customer } = owedState();
  const html = renderCard(customer, state);
  const row = healthRowHtml(html);
  assert.ok(row && row.includes('additional-pending-btn'), '＋ Additional rides on the health row when a bill is owed');
  const outAt = html.indexOf('customer-card-row-label');
  assert.ok(outAt > -1, 'Outstanding row exists');
  const outRow = html.slice(outAt, html.indexOf('customer-card-actions'));
  assert.ok(!outRow.includes('additional-pending-btn'), 'the Outstanding row no longer carries the button');
  assert.ok(outRow.includes('customer-card-row-amount'), 'the Outstanding amount badge stays on the row');
});

test('r2 R1c: the paid-up row branch and the Outstanding-row button are gone from the card source', () => {
  assert.ok(!card.includes('canAddPending && outstanding.totalCents === 0'), 'paid-up row branch deleted');
  const outBranch = card.slice(card.indexOf('${outstanding.totalCents > 0 ?'), card.indexOf('customer-card-actions'));
  assert.ok(!outBranch.includes('${additionalButton}'), 'Outstanding branch no longer interpolates the button');
  assert.ok(card.includes('customer-card-pill-row--spread'), 'health row carries the --spread modifier');
  assert.ok(card.includes('${additionalButton}</span>'), 'the button is interpolated inside the health row');
});

test('r2 R1d: ＋ Additional keeps its dialog wiring (data attribute + both labels)', () => {
  assert.ok(card.includes('data-additional-pending'), 'dialog wiring attribute kept');
  assert.ok(card.includes("t('addpend_add')"), '＋ Additional label key kept');
  assert.ok(card.includes("t('addpend_edit')"), '✎ edit aria-label key kept');
  assert.equal(TRANSLATIONS.en.addpend_add, '+ Additional ▾');
  assert.equal(TRANSLATIONS.ur.addpend_add, '+ اضافی ▾');
  assert.ok(app.includes("querySelectorAll('[data-additional-pending]')"), 'binding still queries the data attribute');
});

test('r2 R1e: archived / FREE cards render no ＋ Additional; a baqaya card renders the ✎ micro-pill on the health row', () => {
  const archived = paidUpState();
  archived.customer.archived = true;
  const archivedHtml = renderCard(archived.customer, archived.state, 'en', true);
  assert.ok(!archivedHtml.includes('additional-pending-btn'), 'archived card has no Additional button');
  const free = paidUpState();
  free.customer.isFreeConnection = true;
  const freeHtml = renderCard(free.customer, free.state);
  assert.ok(!freeHtml.includes('additional-pending-btn'), 'FREE card has no Additional button');
  const { state, customer } = baqayaState();
  const html = renderCard(customer, state);
  const row = healthRowHtml(html);
  assert.ok(row && row.includes('✎'), 'baqaya card renders the ✎ edit variant on the health row (D5)');
  assert.ok(row && !row.includes('+ Additional ▾'), 'the ✎ variant keeps its glyph, not the add label');
});

// ---------- R2 — muted line (6) ----------

test('r2 R2a: the meta line reads mohalla • package • Ref in order, slash compacted (List Cards polish: chips)', () => {
  const { state, customer } = paidUpState();
  const html = renderCard(customer, state);
  assert.ok(html.includes('customer-card-meta-line'), 'meta line class exists');
  const lineAt = html.indexOf('customer-card-meta-line');
  // Phase 1: the meta line's first segment is a nested status span,
  // so the first `</span>` after the line start is the STATUS span's
  // close, not the line's. The line's own close is followed by
  // `</button>` (the outer button closes right after the meta line).
  const line = html.slice(lineAt, html.indexOf('</button>', lineAt));
  // Customers List Cards polish: the segments are colour-coded chips now
  // (no ' • ' join — the flex gap does the spacing), so the order is
  // asserted on the chip spans, not on a dot-separated string.
  const areaAt = line.indexOf('customer-card-meta-chip--area');
  const pkgAt = line.indexOf('customer-card-meta-chip--package');
  const refAt = line.indexOf('customer-card-meta-chip--ref');
  assert.ok(areaAt > -1 && pkgAt > areaAt && refAt > pkgAt, 'chips read mohalla • package • Ref in order');
  assert.ok(line.includes('>Charyaa<'), 'mohalla chip reads Charyaa');
  assert.ok(line.includes('>3Mbps/100GB<'), 'package chip reads 3Mbps/100GB');
  assert.ok(!line.includes('3Mbps / 100GB'), 'package slash is compacted (no spaces around /)');
  assert.ok(line.includes('Reference Person'), 'ref name rides on the line');
});

test('r2 R2b: meta pills are gone — markup and CSS rule both', () => {
  assert.ok(!card.includes('customer-card-meta-pill'), 'no meta-pill in the card template');
  assert.ok(!styles.includes('.customer-card-meta-pill'), 'meta-pill rule deleted from styles.css');
  assert.ok(!app.includes('customer-card-meta-pill'), 'no meta-pill anywhere in app.js');
});

test('r2 R2c: no-Ref case renders the line without the Ref segment (List Cards polish: chips)', () => {
  const { state, customer } = goodState();
  const html = renderCard(customer, state);
  const lineAt = html.indexOf('customer-card-meta-line');
  // Phase 1: slice to `</button>` — the first `</span>` is the nested
  // status span's close now (see R2a).
  const line = html.slice(lineAt, html.indexOf('</button>', lineAt));
  assert.ok(line.includes('customer-card-meta-chip--area'), 'line still shows the mohalla chip');
  assert.ok(line.includes('customer-card-meta-chip--package'), 'line still shows the package chip');
  assert.ok(!line.includes('customer-card-meta-chip--ref'), 'no Ref chip when there is no known-as name');
  assert.ok(!line.includes('Ref:'), 'no Ref segment when there is no known-as name');
});

test('r2 R2d: AKA case keeps the label — "AKA: …" in EN, "دیگر نام: …" in UR (D9)', () => {
  const en = paidUpState();
  en.customer.fatherOrReferenceName = '';
  en.customer.searchAliases = ['Chotu'];
  const enHtml = renderCard(en.customer, en.state, 'en');
  // Phase 1: slice to `</button>` — the first `</span>` is the nested
  // status span's close now (see R2a).
  const enLine = enHtml.slice(enHtml.indexOf('customer-card-meta-line'), enHtml.indexOf('</button>', enHtml.indexOf('customer-card-meta-line')));
  assert.ok(enLine.includes('AKA: <bdi dir="auto">Chotu</bdi>'), `EN AKA line: ${enLine}`);
  const ur = paidUpState();
  ur.customer.fatherOrReferenceName = '';
  ur.customer.searchAliases = ['Chotu'];
  const urHtml = renderCard(ur.customer, ur.state, 'ur');
  const urLine = urHtml.slice(urHtml.indexOf('customer-card-meta-line'), urHtml.indexOf('</button>', urHtml.indexOf('customer-card-meta-line')));
  assert.ok(urLine.includes('دیگر نام: <bdi dir="auto">Chotu</bdi>'), `UR AKA line: ${urLine}`);
});

test('r2 R2e: the ref name rides in <bdi dir="auto"> (Sharafat 94 pattern)', () => {
  const { state, customer } = paidUpState();
  const html = renderCard(customer, state);
  const lineAt = html.indexOf('customer-card-meta-line');
  // Phase 1: slice to `</button>` — the first `</span>` is the nested
  // status span's close now (see R2a).
  const line = html.slice(lineAt, html.indexOf('</button>', lineAt));
  assert.ok(line.includes('<bdi dir="auto">Reference Person</bdi>'), 'ref name is isolated in <bdi dir="auto">');
});

test('r2 R2f: dark mode colours the muted line with the muted dark text (D8)', () => {
  assert.ok(dark.includes('.customer-card-meta-line'), 'dark-contrast.css covers the new meta-line class');
  assert.match(dark, /\[data-theme="dark"\] :is\([^)]*\.customer-card-meta-line[^)]*\) \{[^}]*color: var\(--dk-muted\)/, 'meta line rides the existing muted :is() rule');
});

// ---------- R3 — tenure (5) ----------

test('r2 R3a: tenure is compact "N mos" in EN (List Cards polish D8)', () => {
  const { state, customer } = paidUpState();
  const html = renderCard(customer, state);
  const months = core.summarizeCustomerTenure(customer, new Date()).serviceMonths;
  const pillAt = html.indexOf('customer-card-tenure-pill');
  assert.ok(pillAt > -1, 'tenure pill exists for a current tenure');
  const pill = (html.match(/<span class="customer-card-tenure-pill">(.*?)<\/span>/s) || [])[1] ?? '';
  assert.equal(plainText(pill), `${months} mos`, `tenure reads "${months} mos"`);
  assert.ok(!pill.includes('since'), 'no "since {date}" format left');
});

test('r2 R3b: UR compact tenure is "N ماہ" (List Cards polish D8 — the Latin "(Jun \'26)" leaves with the EN suffix)', () => {
  const { state, customer } = paidUpState();
  const html = renderCard(customer, state, 'ur');
  const pillAt = html.indexOf('customer-card-tenure-pill');
  assert.ok(pillAt > -1, 'tenure pill exists in UR mode');
  const pill = (html.match(/<span class="customer-card-tenure-pill">(.*?)<\/span>/s) || [])[1] ?? '';
  const months = core.summarizeCustomerTenure(customer, new Date()).serviceMonths;
  assert.equal(plainText(pill), `${months} ماہ`, 'UR tenure is just "N ماہ"');
});

test('r2 R3c: cust_card_tenure_since_short is deleted from both dicts and unused in the card', () => {
  assert.equal(TRANSLATIONS.en.cust_card_tenure_since_short, undefined, 'since key deleted from the English dict');
  assert.equal(TRANSLATIONS.ur.cust_card_tenure_since_short, undefined, 'since key deleted from the Urdu dict');
  assert.ok(!card.includes("t('cust_card_tenure_since_short'"), 'since key unused in the card');
  assert.ok(card.includes("t('cust_card_tenure_months_short'"), 'months key still used for the "N mos" half');
  assert.equal(TRANSLATIONS.en.cust_card_tenure_months_short, '{n} mos');
});

test('r2 R3d: tenure pill is ABSENT when no connection date is set (render-level, status-based)', () => {
  const { state, customer } = noDateState();
  assert.equal(core.summarizeCustomerTenure(customer, new Date()).status, 'not-recorded');
  const html = renderCard(customer, state);
  assert.ok(!html.includes('customer-card-tenure-pill'), 'no tenure pill renders for a not-recorded tenure');
  // Phase 1: the standalone pill row is deleted — the Lifetime pill
  // still renders, now as text on the meta line (the "row" it kept
  // in Round 2 no longer exists).
  assert.ok(html.includes('customer-card-lifetime-pill'), 'the Lifetime pill still renders (now on the meta line)');
  assert.ok(card.includes("tenureRaw.status === 'not-recorded'"), 'hide is gated on the status, never on the text (UR-safe)');
});

test('r2 R3e: ended / future tenures still render their primary (only not-recorded hides)', () => {
  const ended = paidUpState();
  ended.customer.archived = true;
  ended.customer.archivedAt = '2026-10-01';
  const endedHtml = renderCard(ended.customer, ended.state, 'en', true);
  assert.ok(endedHtml.includes('customer-card-tenure-pill'), 'ended tenure still renders its pill');
  const future = paidUpState();
  future.customer.connectionDate = '2027-01-01';
  const futureHtml = renderCard(future.customer, future.state);
  assert.ok(futureHtml.includes('customer-card-tenure-pill'), 'future tenure still renders its pill');
});

// ---------- R4 — health tier colour (5) ----------

test('r2 R4a: Risk (60–79) renders the warm amber triple by CATEGORY', () => {
  const { state, customer } = riskState();
  const h = buildCustomerHealthScore(state, customer, new Date());
  assert.equal(h.category, 'Risk');
  assert.ok(h.score >= 60 && h.score < 80, `Risk fixture scores 60–79 (got ${h.score})`);
  const html = renderCard(customer, state);
  const cls = pillClasses(html);
  assert.ok(cls && cls.includes('health-risk'), `Risk pill carries .health-risk: ${cls}`);
  // Phase 1 (D6): the category rules are hardened with !important, so
  // the regex allows the optional `!important` after each value.
  assert.match(styles, /\.customer-card-health-pill\.health-risk \{[^}]*background: #fffbeb(?: !important)?;[^}]*color: #b45309(?: !important)?;[^}]*border: 1px solid #fde68a(?: !important)?;/s, 'Risk rule is the warm amber triple, background → color → border');
  assert.ok(html.includes('Risk'), 'pill text still says Risk');
});

test('r2 R4b: Critical renders rose/red by CATEGORY', () => {
  const { state, customer } = criticalState();
  const h = buildCustomerHealthScore(state, customer, new Date());
  assert.equal(h.category, 'Critical');
  const html = renderCard(customer, state);
  const cls = pillClasses(html);
  assert.ok(cls && cls.includes('health-critical'), `Critical pill carries .health-critical: ${cls}`);
  // Phase 1 (D6): the category rules are hardened with !important, so
  // the regex allows the optional `!important` after each value.
  assert.match(styles, /\.customer-card-health-pill\.health-critical \{[^}]*background: #ffebea(?: !important)?;[^}]*color: #a3342d(?: !important)?;[^}]*border: 1px solid #fecaca(?: !important)?;/s, 'Critical rule is rose with the #fecaca border (D12)');
});

test('r2 R4c: Good (≥80) stays green — no category class', () => {
  const { state, customer } = goodState();
  const h = buildCustomerHealthScore(state, customer, new Date());
  assert.equal(h.category, 'Good');
  assert.ok(h.score >= 80, `Good fixture scores ≥80 (got ${h.score})`);
  const html = renderCard(customer, state);
  const cls = pillClasses(html);
  assert.ok(cls && !cls.includes('health-risk') && !cls.includes('health-critical'), `Good pill carries no category class: ${cls}`);
  assert.ok(cls && cls.includes('health-score-high'), 'Good pill keeps the green score band');
});

test('r2 R4d: no-score pill is neutral — no band, no category class', () => {
  const { state, customer } = noScoreState();
  const h = buildCustomerHealthScore(state, customer, new Date());
  assert.equal(h.score, null);
  const html = renderCard(customer, state);
  const cls = pillClasses(html);
  assert.ok(cls !== null && !cls.includes('health-score-') && !cls.includes('health-risk') && !cls.includes('health-critical'), `no-score pill is neutral: ${cls}`);
  // Customers-tab polish: the no-score card reads the short 'Health: New'
  // label now (the long 'insufficient history' text is gone from the card).
  assert.ok(html.includes('Health: New'), 'no-score pill reads Health: New');
});

test('r2 R4e: 50–59 is labelled Critical and renders rose (D4 — word and colour agree)', () => {
  const { state, customer } = criticalState();
  const h = buildCustomerHealthScore(state, customer, new Date());
  assert.ok(h.score >= 50 && h.score < 60, `D4 fixture scores 50–59 (got ${h.score})`);
  assert.equal(h.category, 'Critical', 'the label for 50–59 is Critical, not Risk');
  const html = renderCard(customer, state);
  const cls = pillClasses(html);
  assert.ok(cls && cls.includes('health-critical'), '50–59 renders rose via .health-critical');
  assert.ok(cls && cls.includes('health-score-mid'), 'the score-band class stays alongside (D3a — additive, helper untouched)');
  assert.equal(cardStyle.healthScoreBandClass(78), 'health-score-high', 'the helper still bands by score (70/40), not by category');
});

// ---------- R5 — action bar (5) ----------

test('r2 R5a: action buttons are 36px — class rule + floor defeater (D1)', () => {
  assert.match(styles, /\.customer-card-action-btn \{[^}]*min-height: 36px;/s, 'class rule is 36px');
  assert.match(styles, /button:not\(\[hidden\]\)\.customer-card-action-btn \{[^}]*min-height: 36px !important;/s, 'the !important defeater exists so <button> actions render 36px, not 44px via the floor');
  assert.match(styles, /button:not\(\[hidden\]\) \{ min-height: 44px !important; \}/, 'the 44px floor itself is intact');
});

test('r2 R5b: the third action says "Profile" in EN and "پروفائل" in UR (D9)', () => {
  assert.equal(TRANSLATIONS.en.cust_card_open_profile, 'Profile');
  assert.equal(TRANSLATIONS.ur.cust_card_open_profile, 'پروفائل');
  const en = paidUpState();
  assert.ok(renderCard(en.customer, en.state).includes('>Profile<'), 'EN card renders Profile');
  const ur = paidUpState();
  assert.ok(renderCard(ur.customer, ur.state, 'ur').includes('>پروفائل<'), 'UR card renders پروفائل');
});

test('r2 R5c: the Profile icon is the existing IdCard, not UserPlus (D6)', () => {
  assert.ok(card.includes("dsIcon('IdCard'"), 'Profile icon is IdCard');
  assert.ok(!card.includes("dsIcon('UserPlus'"), 'UserPlus is gone from the card');
  assert.ok(!read('ds-icons.js').match(/^\s*User:/m), 'no new plain User icon was added to ds-icons.js (D6 reuses IdCard)');
});

test('r2 R5d: all three actions are 36px, including the <a> Call', () => {
  // The <a> Call never meets the floor (it is not a <button>), so the
  // 36px class rule alone sizes it; the <button> Collect/Profile need
  // the defeater (R5a). All three carry the same action-btn class.
  const { state, customer } = paidUpState();
  const html = renderCard(customer, state);
  assert.ok(html.includes('<a class="customer-card-action-btn customer-card-action-call"'), 'Call is an <a> with the action-btn class');
  assert.ok(html.includes('<button type="button" class="customer-card-action-btn customer-card-action-collect"'), 'Collect is a <button> with the action-btn class');
  assert.ok(html.includes('<button type="button" class="customer-card-action-btn customer-card-action-profile"'), 'Profile is a <button> with the action-btn class');
  assert.match(styles, /\.customer-card-action-btn \{[^}]*min-height: 36px;/s, 'one 36px class rule sizes all three');
});

test('r2 R5e: the row still fits at 360px — Collect flex:1 absorbs the rename', () => {
  assert.match(styles, /\.customer-card-action-collect \{[^}]*flex: 1 1 0/s, 'Collect is flex:1 in the action row');
  assert.ok('Profile'.length < 'Full Profile'.length, 'the rename shortens the third button');
  const { state, customer } = paidUpState();
  const html = renderCard(customer, state);
  const actionsAt = html.indexOf('customer-card-actions');
  assert.ok(actionsAt > -1, 'action row exists');
  const actions = html.slice(actionsAt);
  assert.equal((actions.match(/customer-card-action-btn/g) || []).length, 3, 'exactly three action buttons');
});

// ---------- R6 — geometry + guards (4) ----------

test('r2 R6a: card padding is 10px 12px in BOTH the base rule and the ≤620px media query (D10)', () => {
  const hits = styles.match(/\.customer-select\.customer-profile-card-open \{[^}]*padding: 10px 12px;/gs) || [];
  assert.equal(hits.length, 2, `padding 10px 12px appears twice (base + media query), found ${hits.length}`);
});

test('r2 R6b: hex cap 613 holds — the Risk/Critical hexes are already in the set (no new hex)', () => {
  const distinct = new Set(styles.replace(/\/\*[\s\S]*?\*\//g, '').match(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g) || []);
  assert.ok(distinct.size <= 613, `styles.css has ${distinct.size} distinct hex colours, cap is 613 — no new hex`);
  for (const hex of ['#fffbeb', '#b45309', '#fde68a', '#fecaca', '#475569']) {
    assert.ok(styles.toLowerCase().includes(hex), `Risk/Critical/muted hex ${hex} is in the token set`);
  }
  const compDistinct = new Set(comp.replace(/\/\*[\s\S]*?\*\//g, '').match(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g) || []);
  assert.equal(compDistinct.size, 0, 'components.css stays hex-free (token-only file)');
});

test('r2 R6c: the 44px floor is intact and the two defeaters are the ONLY new ones (D1)', () => {
  assert.match(styles, /button:not\(\[hidden\]\) \{ min-height: 44px !important; \}/, 'floor intact');
  assert.match(styles, /button:not\(\[hidden\]\)\.customer-card-action-btn \{[^}]*min-height: 36px !important;/s, '36px action defeater present');
  assert.match(comp, /button:not\(\[hidden\]\)\.additional-pending-btn \{[^}]*min-height: 24px !important;/s, '24px Additional defeater present');
});

test('r2 R6d: the ▾ chevron is in the EN + UR addpend_add values', () => {
  assert.ok(TRANSLATIONS.en.addpend_add.includes('▾'), 'EN label carries ▾');
  assert.ok(TRANSLATIONS.ur.addpend_add.includes('▾'), 'UR label carries ▾');
});

// ---------- R7 — i18n (3) ----------

test('r2 R7a: every changed/added key exists as a string in BOTH dicts', () => {
  for (const key of ['addpend_add', 'cust_card_open_profile', 'cust_card_ref_short', 'cust_card_tenure_months_short', 'cust_card_alias_short']) {
    assert.equal(typeof TRANSLATIONS.en[key], 'string', `EN ${key} exists`);
    assert.equal(typeof TRANSLATIONS.ur[key], 'string', `UR ${key} exists`);
  }
  assert.equal(TRANSLATIONS.en.cust_card_ref_short, 'Ref');
  assert.equal(TRANSLATIONS.ur.cust_card_ref_short, 'حوالہ');
});

test('r2 R7b: the deleted keys are undefined in BOTH dicts', () => {
  for (const key of ['cust_card_father_ref_short', 'cust_card_tenure_since_short']) {
    assert.equal(TRANSLATIONS.en[key], undefined, `EN ${key} deleted`);
    assert.equal(TRANSLATIONS.ur[key], undefined, `UR ${key} deleted`);
  }
});

test('r2 R7c: UR values carry Urdu script where the user reads them', () => {
  assert.match(TRANSLATIONS.ur.cust_card_ref_short, /[\u0600-\u06FF]/, 'UR Ref prefix carries Urdu script');
  assert.match(TRANSLATIONS.ur.cust_card_open_profile, /[\u0600-\u06FF]/, 'UR Profile carries Urdu script');
  assert.match(TRANSLATIONS.ur.addpend_add, /[\u0600-\u06FF]/, 'UR Additional carries Urdu script');
  assert.match(TRANSLATIONS.ur.cust_card_alias_short, /[\u0600-\u06FF]/, 'UR AKA carries Urdu script');
});
