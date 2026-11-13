import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { packageChangePreviewHtml } from '../package-change-preview.js';
import { qualityLogSummaryText, qualityLogHtml } from '../quality-log.js';
import { duesBreakdownSectionHtml } from '../dues-breakdown-by-month.js';

const dir = dirname(fileURLToPath(import.meta.url));
const read = (name) => readFileSync(join(dir, '..', name), 'utf8');
const app = read('app.js');
const styles = read('styles.css');

// Profile Polish E (user spec 2026-11-12, items (18)–(21) of the
// 22-part profile spec):
// (18) Package-change preview: the 'Preview incomplete…' note, the
// speed/service-quality log (explainer + 'No speed measurements
// recorded yet') and the Date field — all PILLS/compact.
// (19) Preview fields (Proposed package, Date, Next bill month,
// Estimate) in ONE consistent BUTTON style, FULLY visible (the form
// had no layout rule at all, so the right-hand fields clipped).
// (20) Package & service info card section ALSO pill style + button
// enhancements.
// (21) Financial Details (Wada, Dues by month) ALSO same style.
//
// Readings decided here (disclosed in the PR body):
// - (18) "Date field" is the quality-log #qualityLogDate; (19)'s
//   "Date" is the preview Effective date.
// - (19) "BUTTON style" is label chips + controls in one consistent
//   treatment, not literal <button> labels (they are form labels).
// - Palette: info-blue (#e5efff / #174b87 / #adc9f1, Polish C/D) for
//   the three custody sections (preview, quality log, info card);
//   service teal (#e7f2ec / #0e5b4d / #9acbad, Polish D) for the
//   Financial rows (Wada, Dues by month). No new hex anywhere.
// - The quality-log 8-column table (non-empty state) and the preview
//   RESULT table stay plain tables — out of scope for E.
// - The Wada quick-form keeps its grid + 38px inputs (Polish #5);
//   its fields get the .pcp-field-pill chips on their labels.

// ------------------------------------------------------------ (18a) preview-incomplete note

test('Polish E (18): the Preview incomplete note is an info pill, wording unchanged', () => {
  const html = packageChangePreviewHtml({ status: 'incomplete', reasons: ['no price'] }, (amount) => `PKR ${amount}`);
  assert.match(html, /Preview incomplete/, 'the note still says Preview incomplete');
  assert.ok(html.includes('class="package-change-preview-incomplete"'), 'the note keeps its class');
  const rule = styles.match(/#packageChangePreviewResult \.package-change-preview-incomplete\{[^}]*\}/);
  assert.ok(rule, 'the incomplete note has a scoped pill rule');
  assert.ok(rule[0].includes('background:#e5efff') && rule[0].includes('color:#174b87') && rule[0].includes('border:1px solid #adc9f1'), 'the info-blue palette');
  assert.ok(rule[0].includes('border-radius:12px'), 'a long note is an info note, not a one-line pill');
});

// ------------------------------------------------------------ (18b) speed / service-quality log

test('Polish E (18): the quality-log explainer is an info note, wording unchanged', () => {
  assert.ok(app.includes('<p class="pcp-explainer">When a customer says'), 'the explainer carries its info-note class');
  assert.ok(app.includes('This is a record only, not a live speed test and not a billing or package input; logging never changes any charge, bill, payment, or ticket.</p>'), 'the explainer wording is unchanged');
});

test('Polish E (18): the quality-log summary and empty state are pills; the module strings are unchanged', () => {
  assert.ok(app.includes('<p id="qualityLogSummary" class="ql-summary-pill">'), 'the summary line carries its pill class');
  const summaryRule = styles.match(/\.ql-summary-pill\{[^}]*\}/);
  assert.ok(summaryRule && summaryRule[0].includes('border-radius:999px'), 'the summary is a real pill');
  assert.ok(summaryRule && summaryRule[0].includes('background:#e5efff'), 'the info-blue palette');
  const emptyRule = styles.match(/#qualityLogList \.empty-state\{[^}]*\}/);
  assert.ok(emptyRule && emptyRule[0].includes('border-radius:999px'), 'the empty state is a pill too');
  assert.ok(emptyRule && emptyRule[0].includes('background:#e5efff'), 'the info-blue palette');
  // The pill look comes from scoped CSS only — the module strings that
  // plan47 pins byte-exact are untouched.
  assert.equal(qualityLogSummaryText([], 15), 'No speed measurements recorded yet.');
  assert.equal(qualityLogHtml([], 15), '<p class="empty-state">No speed measurements recorded yet.</p>');
});

test('Polish E (18): the quality-log Date field carries the pill chip, in the wrapping form', () => {
  assert.ok(app.includes('<div class="pcp-form"><label><span class="pcp-field-pill">Date</span> <input id="qualityLogDate"'), 'the Date label sits in a pill chip inside the wrapping form');
  assert.ok(app.includes('id="qualityLogDate"'), 'the Date control id is unchanged');
});

// ------------------------------------------------------------ (19) preview fields, one button style

test('Polish E (19): all four preview fields carry the pill chip, control ids unchanged', () => {
  assert.ok(app.includes('<span class="pcp-field-pill">Proposed package</span> <select id="packageChangePreviewPackage">'), 'Proposed package keeps its chip');
  assert.ok(app.includes('<span class="pcp-field-pill">Effective date</span> <input id="packageChangePreviewDate"'), 'Effective date gains its chip');
  assert.ok(app.includes('<span class="pcp-field-pill">Next bill month</span> <input id="packageChangePreviewMonth"'), 'Next bill month gains its chip');
  assert.ok(app.includes('<span class="pcp-field-pill">Estimate</span> <select id="packageChangePreviewMode">'), 'Estimate gains its chip');
  assert.ok(app.includes('id="packageChangePreviewShowBtn"'), 'the Show preview button is unchanged');
});

test('Polish E (19): the preview form wraps instead of clipping — one flex row, one control treatment', () => {
  assert.ok(app.includes('<div class="pcp-form"><label><span class="pcp-field-pill">Proposed package</span>'), 'the preview form carries the wrapping class');
  const formRule = styles.match(/\.pcp-form\{[^}]*\}/);
  assert.ok(formRule && formRule[0].includes('display:flex') && formRule[0].includes('flex-wrap:wrap'), 'the form is a wrapping flex row');
  const labelRule = styles.match(/\.pcp-form label\{[^}]*\}/);
  assert.ok(labelRule && labelRule[0].includes('display:inline-flex'), 'each label is a chip + control row');
  const controlRule = styles.match(/\.pcp-form select,\.pcp-form input\{[^}]*\}/);
  assert.ok(controlRule && controlRule[0].includes('height:38px'), 'controls share one height');
  assert.ok(controlRule && controlRule[0].includes('border:1px solid #adc9f1'), 'controls share the info-blue border');
  assert.ok(controlRule && controlRule[0].includes('max-width:100%'), 'controls can never overflow the form');
});

test('Polish E (19): the new pill rules sit after the SISP-106 no-hex block', () => {
  const focusAt = styles.indexOf('.boost-add-form input:focus');
  assert.notEqual(focusAt, -1, 'the SISP-106 block must still end at input:focus');
  assert.ok(styles.indexOf('.pcp-form{') > focusAt, 'the .pcp-form rules sit after the SISP-106 block, so their hex cannot trip the no-hex test');
});

// ------------------------------------------------------------ (20) info card section

test('Polish E (20): the info-card explainer is an info note and Draft language carries the pill chip', () => {
  assert.ok(app.includes('<p class="pcp-explainer">When the customer asks'), 'the explainer carries its info-note class');
  assert.ok(app.includes('This is a draft only: sending opens WhatsApp with the text prefilled and logs the send; it changes no package, billing, or lifecycle record.</p>'), 'the explainer wording is unchanged');
  assert.ok(app.includes('<div class="pcp-form"><label><span class="pcp-field-pill">Draft language</span> <select id="infoCardVariant">'), 'Draft language sits in a pill chip inside the wrapping form');
  assert.ok(app.includes('id="infoCardShowBtn"'), 'the Show card button is unchanged');
  assert.ok(app.includes('id="infoCardSendBtn"'), 'the Send button is unchanged');
});

test('Polish E (20): the info-card result rows are info-blue pills, ids unchanged', () => {
  const listRule = styles.match(/#infoCardResult ul\{[^}]*\}/);
  assert.ok(listRule && listRule[0].includes('display:grid'), 'the result list keeps its grid');
  const rowRule = styles.match(/#infoCardResult ul li\{[^}]*\}/);
  assert.ok(rowRule && rowRule[0].includes('border-radius:999px'), 'each result row is a real pill');
  assert.ok(rowRule && rowRule[0].includes('background:#e5efff') && rowRule[0].includes('color:#174b87'), 'the info-blue palette');
  const emptyRule = styles.match(/#infoCardResult \.empty-state\{[^}]*\}/);
  assert.ok(emptyRule && emptyRule[0].includes('border-radius:999px'), 'the unavailable state is a pill too');
  assert.ok(app.includes('id="infoCardResult"'), 'the result container id is unchanged');
});

// ------------------------------------------------------------ (21a) Wada

test('Polish E (21): the Wada banner rows are real pills with state borders', () => {
  const rowRule = styles.match(/\.wada-banner-row\{[^}]*\}/);
  assert.ok(rowRule && rowRule[0].includes('border-radius:999px'), 'banner rows are real pills');
  const onTrack = styles.match(/\.wada-banner-on-track\{[^}]*\}/);
  assert.ok(onTrack && onTrack[0].includes('background:#e8f5ed') && onTrack[0].includes('border:1px solid #b7e1cd'), 'on-track keeps its green with a matching border');
  const overdue = styles.match(/\.wada-banner-overdue\{[^}]*\}/);
  assert.ok(overdue && overdue[0].includes('background:#fdeceb') && overdue[0].includes('border:1px solid #f0dbd8'), 'overdue keeps its red with a matching border');
});

test('Polish E (21): the Wada none line, health line and history rows are pills; the quick-form labels carry chips', () => {
  const noneRule = styles.match(/\.wada-banner-none\{[^}]*\}/);
  assert.ok(noneRule && noneRule[0].includes('border-radius:999px') && noneRule[0].includes('background:#e7f2ec'), 'no open wada reads as a teal pill');
  const healthRule = styles.match(/\.wada-health\{[^}]*\}/);
  assert.ok(healthRule && healthRule[0].includes('border-radius:999px') && healthRule[0].includes('background:#e7f2ec'), 'the health line is a teal pill');
  const historyRule = styles.match(/\.wada-history li\{[^}]*\}/);
  assert.ok(historyRule && historyRule[0].includes('border-radius:999px') && historyRule[0].includes('background:#e7f2ec'), 'each history row is a teal pill');
  assert.ok(app.includes('<label for="wadaQuickDate"><span class="pcp-field-pill">Promised date</span><input id="wadaQuickDate"'), 'the date label carries its chip');
  assert.ok(app.includes('<label for="wadaQuickAmount"><span class="pcp-field-pill">Amount promised (Rs, optional)</span><input id="wadaQuickAmount"'), 'the amount label carries its chip');
  assert.ok(app.includes('<label for="wadaQuickNote"><span class="pcp-field-pill">Note (optional)</span><input id="wadaQuickNote"'), 'the note label carries its chip');
  assert.ok(app.includes('id="wadaQuickForm"') && app.includes('id="wadaQuickSaveBtn"'), 'the quick-form ids are unchanged');
  assert.ok(app.includes('data-wada-kept') && app.includes('data-wada-broken') && app.includes('data-wada-remove'), 'the banner/history action attributes are unchanged');
});

// ------------------------------------------------------------ (21b) Dues by month

test('Polish E (21): the Dues by month rows are teal pills, the total and empty state are pills, pinned strings render', () => {
  const rowRule = styles.match(/\.dmb-list>li\{[^}]*\}/);
  assert.ok(rowRule && rowRule[0].includes('background:#e7f2ec') && rowRule[0].includes('border:1px solid #9acbad'), 'each month row is a teal pill');
  assert.ok(rowRule && rowRule[0].includes('border-radius:12px'), 'rows are soft-cornered cards, not capsules');
  const monthRule = styles.match(/\.dmb-month\{[^}]*\}/);
  assert.ok(monthRule && monthRule[0].includes('color:#0e5b4d'), 'the month reads in teal');
  const totalRule = styles.match(/\.dmb-total\{[^}]*\}/);
  assert.ok(totalRule && totalRule[0].includes('border-radius:999px') && totalRule[0].includes('background:#e7f2ec'), 'the total is a prominent teal pill');
  const noneRule = styles.match(/\.dmb-none\{[^}]*\}/);
  assert.ok(noneRule && noneRule[0].includes('border-radius:999px') && noneRule[0].includes('background:#e7f2ec'), 'the empty state is a teal pill');
  // Pinned strings still render (plan370 pins them too — this guards
  // that E changed styling only, never the strings).
  const formatRs = (value) => `Rs ${Number(value).toFixed(2)}`;
  const stubAllocations = (summaries) => ({ forMonth: (customerId, month) => summaries[`${customerId}|${month}`] ?? null });
  const priced = duesBreakdownSectionHtml(
    { id: 'CUST-1', bills: [{ month: '2026-10' }] },
    stubAllocations({ 'CUST-1|2026-10': { billAmountCents: 300000, balanceDueCents: 100000 } }),
    0, {}, formatRs,
  );
  assert.ok(priced.includes('<ul id="dmbList" class="dmb-list">'), 'the month list keeps its id');
  assert.ok(priced.includes('<span class="dmb-month">2026-10</span>'), 'the month still renders');
  assert.ok(priced.includes('<span class="dmb-owed">Still owed Rs 1000.00</span>'), 'the owed figure still renders');
  assert.ok(priced.includes('Total still owed Rs 1000.00'), 'the total still renders');
  const empty = duesBreakdownSectionHtml({ id: 'CUST-1', bills: [] }, stubAllocations({}), 0, {}, formatRs);
  assert.ok(empty.includes('<p class="dmb-none">No bills recorded yet.</p>'), 'the empty state still renders');
});

// ------------------------------------------------------------ ratchet

test('Polish E ratchet: styles.css still 614 distinct hex (no new hard-coded colour)', () => {
  const stripped = styles.replace(/\/\*[\s\S]*?\*\//g, '');
  const distinct = new Set(stripped.match(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g) || []);
  assert.equal(distinct.size, 614, 'styles.css must stay at 614 distinct hex (no new hard-coded colour)');
});

test('Polish E: no real customer names or phone numbers in this test', () => {
  const testSrc = read('tests/profile-polish-e.test.js');
  const phoneShape = /(?:\+92|03)\d[\d\s-]{8,}\d/;
  assert.ok(!phoneShape.test(testSrc), 'test must not contain a realistic phone number');
});
