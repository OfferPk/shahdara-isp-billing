// Sharafat 94 — bidi isolation only on translated leaf text: in Urdu mode
// the Latin amounts/phones in the customer card, the current-bill grid,
// the dashboard templates and the customer table row can jump (a Latin
// "PKR 1,200" or a phone number reorders inside RTL text). The fix wraps
// each amount/phone in <bdi> at the template site — literal <bdi> at
// direct interpolation points, split-on-param-value where the amount
// rides inside t(), and whole-string <bdi> where the dashboard string
// is amount-first in both languages. The shared leaf path
// (BIDI_TOKEN_PATTERN / translateLeaf) is untouched, so decimals still
// split there — disclosed follow-up, not a regression (see F9 note).
//
// CORRECTED (prep error): the prep counted 24 dashboard template sites,
// but 2 are textContent writes (fcst_credit_applied, fcst_run_rate) whose
// template literal is the RHS of a textContent assignment — a literal
// <bdi> there would render as visible text, so they stay raw (D6) and
// join the R7 follow-up. The true HTML template count is 22 (F7), and
// F7b guards that the 2 fcst sites carry no literal <bdi>.
//
// Source pins only for app.js / form-validation.js (which no test
// executes) + live checks against the real nav-language.js t() and
// core.js formatPKR — the 88/93 pattern. Fixtures are generic
// placeholders only — no real customer data.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { t } from '../nav-language.js';
import { formatPKR } from '../core.js';

const read = (name) => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const app = read('app.js');
const formValidation = read('form-validation.js');

function fnBody(src, startMarker, endMarker) {
  const start = src.indexOf(startMarker);
  if (start === -1) return null;
  const end = src.indexOf(endMarker, start);
  return end === -1 ? src.slice(start) : src.slice(start, end);
}

// A needle is bidi-wrapped when it sits inside a <bdi>...</bdi> pair.
function wrappedInBdi(text, needle) {
  const at = text.indexOf(needle);
  if (at === -1) return false;
  const open = text.lastIndexOf('<bdi>', at);
  if (open === -1) return false;
  const close = text.indexOf('</bdi>', at);
  return close !== -1 && close > at;
}
// Region helper: the HTML between a class marker and its closing </span>.
function spanRegion(text, marker) {
  const at = text.indexOf(marker);
  if (at === -1) return null;
  const end = text.indexOf('</span>', at);
  return end === -1 ? text.slice(at) : text.slice(at, end);
}
// Template-literal scanner: track unescaped-backtick parity across the
// span; a formatAmount( call is a template site when it sits inside a
// template literal (textContent writes and composed consts are NOT
// template sites).
function templateSites(text) {
  const sites = [];
  const lines = text.split('\n');
  let inTpl = false;
  for (const ln of lines) {
    const ticks = (ln.match(/(?<!\\)`/g) || []).length;
    const wasIn = inTpl;
    if (ticks % 2 === 1) inTpl = !inTpl;
    let idx = 0;
    while (true) {
      const at = ln.indexOf('formatAmount(', idx);
      if (at === -1) break;
      const opensBefore = (ln.slice(0, at).match(/(?<!\\)`/g) || []).length;
      if (wasIn || opensBefore % 2 === 1) sites.push({ line: ln, at });
      idx = at + 1;
    }
  }
  return sites;
}

const card = fnBody(app, 'function customerCardMarkup(', '\nlet customerCurrentPage');
const bill = fnBody(app, 'function renderCurrentBillSummary(', '\n// Owner feature (2026-10-29): Manual Baqaya profile flows.');
const dash = fnBody(app, 'function renderDashboard(', '\nfunction initials(');
const row = fnBody(formValidation, 'export function renderCustomerTableRowMarkup(', '\n/**');

test('sharafat 94: card outstanding amount is wrapped in <bdi>', () => {
  assert.ok(card, 'customerCardMarkup found');
  assert.ok(wrappedInBdi(card, 'escapeHtml(formatAmount(outstanding.total))'),
    'outstanding row still interpolates the amount raw');
});

test('sharafat 94: card lifetime pill isolates the amount + receipt count in <bdi>', () => {
  assert.ok(card, 'customerCardMarkup found');
  const pill = spanRegion(card, 'customer-card-lifetime-pill') || '';
  assert.ok(pill.includes('<bdi>'), 'lifetime pill has no <bdi>');
  // The count sits INSIDE the amount's own isolated region (R11): a
  // parens count outside the <bdi> would mirror in RTL.
  assert.ok(pill.includes('(${receipts.receiptCount})'), 'receipt count missing from the pill');
  const bdiOpen = pill.indexOf('<bdi>');
  const bdiClose = pill.indexOf('</bdi>');
  assert.ok(bdiOpen !== -1 && bdiClose > bdiOpen, 'lifetime <bdi> pair malformed');
  assert.ok(pill.slice(bdiOpen, bdiClose).includes('(${receipts.receiptCount})'),
    'receipt count is outside the <bdi>');
});

test('sharafat 94: card baqaya breakdown isolates both amounts in <bdi>', () => {
  assert.ok(card, 'customerCardMarkup found');
  assert.ok(wrappedInBdi(card, 'formatPKR(outstanding.billDues)'),
    'bill amount in the breakdown is not isolated');
  assert.ok(wrappedInBdi(card, 'formatPKR(outstanding.manualBaqaya)'),
    'additional amount in the breakdown is not isolated');
});

test('sharafat 94: card chip fee amount is wrapped in <bdi>', () => {
  assert.ok(card, 'customerCardMarkup found');
  const badge = spanRegion(card, 'customer-billing-badge') || '';
  assert.ok(badge.includes('<bdi>'), 'chip fee amount rides inside t() + escapeHtml() with no isolation');
});

test('sharafat 94: card tenure, health and badge-month runs are wrapped in <bdi>', () => {
  assert.ok(card, 'customerCardMarkup found');
  const tenure = spanRegion(card, 'customer-card-tenure-pill') || '';
  const health = spanRegion(card, 'customer-card-health-pill') || '';
  const badgeAt = card.indexOf('formatReceiptMonth(tagged.month)');
  const badgeCtx = badgeAt === -1 ? '' : card.slice(Math.max(0, badgeAt - 120), badgeAt + 120);
  assert.ok(tenure.includes('<bdi>'), 'tenure pill has no <bdi>');
  assert.ok(health.includes('<bdi>'), 'health pill has no <bdi>');
  assert.ok(badgeCtx.includes('<bdi>'), 'badge-month has no <bdi>');
});

test('sharafat 94: current-bill grid wraps all 9 formatAmount sites in <bdi>', () => {
  assert.ok(bill, 'renderCurrentBillSummary found');
  const sites = [...bill.matchAll(/formatAmount\(/g)].length;
  assert.equal(sites, 9, `bill grid has ${sites} formatAmount sites, expected 9`);
  let okCount = 0;
  let idx = 0;
  while (true) {
    const at = bill.indexOf('formatAmount(', idx);
    if (at === -1) break;
    const open = Math.max(bill.lastIndexOf('<bdi>', at), bill.lastIndexOf('<bdi ', at));
    const close = bill.indexOf('</bdi>', at);
    if (open !== -1 && close !== -1 && close > at) okCount += 1;
    idx = at + 1;
  }
  assert.equal(okCount, 9, `${okCount} of 9 bill-grid sites inside <bdi>`);
});

test('sharafat 94: dashboard wraps all 22 HTML template formatAmount sites in <bdi>', () => {
  assert.ok(dash, 'renderDashboard found');
  // The 2 fcst textContent sites are NOT HTML templates (see header) —
  // they are excluded here and guarded by the F7b test below.
  const sites = templateSites(dash).filter((s) => !s.line.includes('fcst_credit_applied') && !s.line.includes('fcst_run_rate'));
  assert.equal(sites.length, 22, `dashboard has ${sites.length} HTML template sites, expected 22`);
  let okCount = 0;
  for (const { line, at } of sites) {
    const open = Math.max(line.lastIndexOf('<bdi>', at), line.lastIndexOf('<bdi ', at));
    const close = line.indexOf('</bdi>', at);
    if (open !== -1 && close !== -1 && close > at) okCount += 1;
  }
  assert.equal(okCount, 22, `${okCount} of 22 dashboard sites inside <bdi>`);
});

test('sharafat 94: fcst textContent sites contain no literal <bdi> (D6)', () => {
  assert.ok(dash, 'renderDashboard found');
  const fcstLines = dash.split('\n').filter((l) => l.includes('fcst_credit_applied') || l.includes('fcst_run_rate'));
  assert.equal(fcstLines.length, 2, `expected 2 fcst lines, found ${fcstLines.length}`);
  for (const line of fcstLines) {
    assert.ok(!line.includes('<bdi>'), 'a literal <bdi> in a textContent string would render as visible text');
  }
});

test('sharafat 94: table-view phone subline and PKR balance are wrapped in <bdi>', () => {
  assert.ok(row, 'renderCustomerTableRowMarkup found');
  assert.ok(wrappedInBdi(row, 'escapeHtml(customer.phone)'), 'table phone subline is not isolated');
  assert.ok(wrappedInBdi(row, 'PKR ${safeNum}'), 'table PKR balance is not isolated');
});

test('sharafat 94: breakdown placeholder round-trip isolates both amounts, even when equal', () => {
  // The card composes the breakdown with placeholder tokens ('\u0001' /
  // '\u0002') because bill and additional can be EQUAL — splitting on
  // the amount value itself would nest <bdi> tags. Drive the same
  // round-trip through the real t() in both languages.
  const render = (lang, billVal, addVal) => t('addpend_breakdown', lang, { bill: '\u0001', additional: '\u0002' })
    .replace('\u0001', `<bdi>${formatPKR(billVal)}</bdi>`)
    .replace('\u0002', `<bdi>${formatPKR(addVal)}</bdi>`);
  for (const lang of ['en', 'ur']) {
    const out = render(lang, 1200, 1200);
    assert.equal((out.match(/<bdi>/g) || []).length, 2, `${lang}: expected 2 <bdi> opens, got ${out}`);
    assert.equal((out.match(/<\/bdi>/g) || []).length, 2, `${lang}: expected 2 </bdi> closes, got ${out}`);
    assert.ok(!out.includes('<bdi><bdi>'), `${lang}: nested <bdi> — the equal-value case broke`);
    assert.ok(out.includes('<bdi>PKR 1,200</bdi>'), `${lang}: amount not isolated, got ${out}`);
    assert.ok(!out.includes('\u0001') && !out.includes('\u0002'), `${lang}: placeholder token leaked into output`);
  }
  const distinct = render('en', 1200, 500);
  assert.ok(distinct.includes('<bdi>PKR 1,200</bdi>') && distinct.includes('<bdi>PKR 500</bdi>'),
    `distinct values not isolated, got ${distinct}`);
});
