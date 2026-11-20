/**
 * month-end-close-balance-proof-sweep.test.js — Month-End Close,
 * Balance Proof, Wallet Sweep & Collapsed Registries polish.
 * Pins (prep §3 D1–D8, all ★):
 * - D1: the 'Tick step' button shows a white label on its green
 *   background — the components.css rule's color is var(--white)
 *   while the green border stays (the area-analytics pin still
 *   needs var(--ds-brand) in that rule). Why-comment: the label
 *   always existed in markup; only the colour was invisible.
 * - D2: the six KPI boxes stack label above value via a SCOPED
 *   .roll-forward-equation .ds-stat-box flex-column rule. The base
 *   .ds-stat-box block is DS-0-pinned and stays untouched.
 * - D3: wallet cards no longer print the raw UUID in the meta line
 *   (render-only); the id stays in the sweep data, the sort
 *   tiebreak and the CSV, and the date + TID stay on the card.
 *   Suspense/claim ids still render — the scope is wallet only.
 * - D4: the three '+ Record' summaries are vertically centred —
 *   styles.css:419 itself is inline-flex with the spec padding.
 *   Why-comment: adding .registry-create-summary cannot work, the
 *   (0,1,1) rule beats the (0,1,0) class.
 * - D5: the three standalone (i) buttons are 28px and sit with
 *   their heading in a .registry-heading-row, before the caption.
 *   The global .help-icon stays 40px.
 * - D6: at 0 job sheets the section collapses to its summary line
 *   + the single '+ Add Job Cost Sheet' disclosure; Export,
 *   filters and the mutation rows hide on TOTAL entries.
 * - D7: Waive/Untick/Remove hide with no close record and
 *   'Remove snapshot' hides with no stored snapshot; Tick stays
 *   visible and Close/Reopen keep their disabled pattern.
 * - D8: roll-forward cells are 7px padded and the per-customer
 *   detail tables scroll inside .table-scroll too.
 * No new keys: parity and pin-file counts are asserted by the
 * dedicated parity files, never here. Synthetic data only; no
 * ledger record is ever changed by this item.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  rollForwardEquationHtml,
  rollForwardTableHtml,
  rollForwardHtml,
} from '../balance-rollforward.js';
import {
  buildPrecloseSweep,
  precloseSweepHtml,
  precloseSweepCsv,
} from '../preclose-sweep.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const read = (name) => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');
const indexHtml = read('index.html');
const appJs = read('app.js');
const stylesCss = read('styles.css');
const componentsCss = read('components.css');

const FAKE_UUID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'; // format example only
const FAKE_TID = 'TID-0000000000';
const FAKE_DATE = '2026-11-18';

function ruleBlock(css, selectorStart) {
  const at = css.indexOf(selectorStart);
  if (at < 0) return null;
  const open = css.indexOf('{', at);
  const close = css.indexOf('}', open);
  if (open < 0 || close < 0) return null;
  return css.slice(open + 1, close);
}

function sweepFixture() {
  return buildPrecloseSweep({
    month: '2026-11',
    suspenseItems: [{ id: 'SUSP-001', label: 'SUSP-001', detail: `Wallet · ${FAKE_TID}`, amount: 100, date: FAKE_DATE }],
    walletItems: [{ id: FAKE_UUID, bucket: 'unmatched', label: 'Test Customer', detail: `Easypaisa · ${FAKE_TID} · Test detail`, amount: 12345, date: FAKE_DATE }],
    claims: [],
    handovers: [],
    monthClose: null,
  });
}

function equationFixture() {
  return {
    openingCents: 100000, chargesCents: 12345600, paymentsCents: 11111100,
    concessionsCents: 2222200, computedCents: 1333300, reportedCents: 1333300,
    reconciles: true, differenceCents: 0,
  };
}

// --- D1: Tick button label visible ------------------------------------------
test('D1: Tick rule prints a white label on the green button, border stays green', () => {
  const tickRule = ruleBlock(componentsCss, '.analytics-btn-row .month-close-tick-btn {');
  assert.ok(tickRule, 'tick rule present in components.css');
  const colorDecl = tickRule.split(';').map((d) => d.trim()).find((d) => d.startsWith('color:'));
  assert.ok(colorDecl && /var\(--white\)/.test(colorDecl), `tick color is white, got: ${colorDecl}`);
  assert.ok(/border-color:\s*var\(--ds-brand\)/.test(tickRule), 'green border kept for the area-analytics pin');
});

test('D1: Tick button carries its label in markup', () => {
  assert.ok(indexHtml.includes('id="monthCloseTickBtn"') && indexHtml.includes('>Tick step<'));
});

// --- D2: KPI cards stack label above value -----------------------------------
test('D2: scoped KPI rule stacks label above value, base .ds-stat-box untouched', () => {
  const kpiRule = stylesCss.match(/\.roll-forward-equation[^{]*\.ds-stat-box\s*\{[^}]*\}/);
  assert.ok(kpiRule, 'scoped .roll-forward-equation .ds-stat-box rule present');
  assert.match(kpiRule[0], /display:\s*flex/);
  assert.match(kpiRule[0], /flex-direction:\s*column/);
  assert.match(kpiRule[0], /gap:\s*4px/);
  const base = ruleBlock(componentsCss, '.ds-stat-box {');
  assert.ok(base && /min-height:\s*56px/.test(base) && /background:\s*var\(--ds-nested\)/.test(base),
    'base .ds-stat-box rule untouched (DS-0 pin)');
});

test('D2: equation renders six label+value boxes', () => {
  const html = rollForwardEquationHtml(equationFixture());
  assert.ok(/ds-stat-box__label/.test(html) && /ds-stat-box__value/.test(html));
  assert.equal((html.match(/ds-stat-box"/g) || []).length, 6);
});

// --- D3: wallet UUID off the card, still in data + CSV -----------------------
test('D3: wallet UUID absent from card HTML, date + TID stay, suspense id stays', () => {
  const html = precloseSweepHtml(sweepFixture());
  assert.ok(!html.includes(FAKE_UUID), 'wallet UUID not rendered on the card');
  assert.ok(html.includes(FAKE_TID) && html.includes(FAKE_DATE), 'date + TID still on the wallet card');
  assert.ok(html.includes('SUSP-001'), 'readable suspense id still renders (wallet scope only)');
});

test('D3: wallet id stays in sweep data and CSV (load-bearing)', () => {
  const sweep = sweepFixture();
  const walletItem = sweep.groups.find((g) => g.id === 'wallet')?.items?.[0];
  assert.ok(walletItem && walletItem.id === FAKE_UUID, 'sweep data still carries the wallet id');
  assert.ok(precloseSweepCsv(sweep).includes(FAKE_UUID), 'sweep CSV still carries the id');
});

// --- D4: '+ Record' summaries centred ---------------------------------------
test('D4: record summaries are inline-flex, centred, with the spec padding', () => {
  const summaryRule = ruleBlock(stylesCss, '.registry-create-details > summary {');
  assert.ok(summaryRule, 'summary rule present');
  assert.match(summaryRule, /display:\s*inline-flex/);
  assert.match(summaryRule, /align-items:\s*center/);
  assert.match(summaryRule, /justify-content:\s*center/);
  assert.match(summaryRule, /padding:\s*10px 16px/);
});

test('D4: the three + Record summaries exist in markup', () => {
  for (const label of ['+ Record Enquiry', '+ Record Equipment Deposit', '+ Issue Loan Equipment']) {
    assert.ok(indexHtml.includes(`>${label}<`), `summary "${label}" present`);
  }
});

// --- D5: (i) buttons 28px, inline next to the heading ------------------------
test('D5: scoped help-icon is 28px and the heading row is a centred flex row', () => {
  const helpRule = stylesCss.match(/\.analytics-panel[^{]*\.help-icon\s*\{[^}]*\}/);
  assert.ok(helpRule, 'scoped .analytics-panel .help-icon rule present');
  const width = /width:\s*(\d+)px/.exec(helpRule[0])?.[1];
  const minHeight = /min-height:\s*(\d+)px/.exec(helpRule[0])?.[1];
  assert.equal(Number(width), 28);
  assert.equal(Number(minHeight), 28);
  const headRowRule = ruleBlock(stylesCss, '.registry-heading-row {');
  assert.ok(headRowRule && /display:\s*flex/.test(headRowRule) && /align-items:\s*center/.test(headRowRule));
});

for (const [heading, label] of [
  ['enquiryLogHeading', 'enquiry'], ['depositRegisterHeading', 'deposit'], ['loanTrackerHeading', 'loan'],
]) {
  test(`D5: ${label} (i) sits with the heading in a flex row, before the caption`, () => {
    const hAt = indexHtml.indexOf(`id="${heading}"`);
    const secStart = indexHtml.lastIndexOf('<section', hAt);
    const sec = indexHtml.slice(secStart, hAt + 3000);
    const detailsAt = sec.indexOf('<details class="help-tip">');
    const captionAt = sec.indexOf('<p class="chart-caption">');
    const wrapAt = sec.indexOf('registry-heading-row');
    assert.ok(detailsAt >= 0 && captionAt >= 0 && detailsAt < captionAt, '(i) before the caption');
    assert.ok(wrapAt >= 0 && wrapAt < detailsAt, 'heading-row wrapper before the (i)');
  });
}

test('D5: global .help-icon stays 40px (dashboard, profile, customers untouched)', () => {
  const base = ruleBlock(stylesCss, '.help-icon{');
  assert.ok(base && /width:40px/.test(base) && /height:40px/.test(base));
});

// --- D6: job-cost collapses at 0 sheets --------------------------------------
test('D6: single "+ Add Job Cost Sheet" disclosure exists', () => {
  assert.ok(indexHtml.includes('id="jobCostCreateDetails"'));
  assert.ok(indexHtml.includes('>+ Add Job Cost Sheet<'));
});

test('D6: renderJobCost hides Export, filter row and mutation rows at 0 sheets', () => {
  const render = appJs.slice(appJs.indexOf('function renderJobCost()'), appJs.indexOf('function renderJobCost()') + 9000);
  assert.match(render, /jobCostExportBtn/);
  assert.match(render, /hasJobs/);
  assert.match(render, /entries\.length > 0/);
  assert.match(render, /jobCostFilterRow/);
  assert.match(render, /jobCostMutationRow/);
  assert.match(render, /jobCostActionsRow/);
  assert.match(render, /display/);
});

test('D6: filter row, mutation row and actions row carry ids the render can hide', () => {
  assert.ok(indexHtml.includes('id="jobCostFilterRow"'));
  assert.ok(indexHtml.includes('id="jobCostMutationRow"'));
  assert.ok(indexHtml.includes('id="jobCostActionsRow"'));
});

// --- D7: secondary buttons hide with no record -------------------------------
test('D7: Waive/Untick/Remove hide when no close record exists; Tick stays visible', () => {
  const render = appJs.slice(appJs.indexOf('function renderMonthClose()'), appJs.indexOf('function renderMonthClose()') + 6000);
  assert.match(render, /monthCloseWaiveBtn/);
  assert.match(render, /monthCloseUntickBtn/);
  assert.match(render, /monthCloseRemoveBtn/);
  assert.match(render, /!record/);
  assert.match(render, /hidden/);
  assert.ok(indexHtml.includes('id="monthCloseTickBtn"') && !/monthCloseTickBtn[^>]*hidden/.test(indexHtml),
    'Tick not hidden in markup');
  assert.match(render, /closeBtn\.disabled = !record/);
  assert.match(render, /reopenBtn\.disabled = !record/);
});

test('D7: Remove snapshot hides when no snapshot is stored', () => {
  const render = appJs.slice(appJs.indexOf('function renderMonthSnapshots()'), appJs.indexOf('function renderMonthSnapshots()') + 6000);
  assert.match(render, /monthSnapshotRemoveBtn/);
  assert.match(render, /findSnapshot/);
  assert.match(render, /hidden/);
});

test('D7: Tick wiring intact', () => {
  assert.ok(appJs.includes("$('#monthCloseTickBtn')?.addEventListener('click', () => stepAction('tick'))"));
});

// --- D8: compact rows, detail tables scroll ----------------------------------
test('D8: scoped roll-forward cell padding is 7px vertical', () => {
  const padRule = stylesCss.match(/\.roll-forward-table[^{]*\{[^}]*padding:[^}]*\}/);
  assert.ok(padRule, 'scoped roll-forward padding rule present');
  const vertical = /padding:\s*(\d+)px/.exec(padRule[0])?.[1];
  assert.ok(vertical !== null && Number(vertical) <= 8, `vertical padding ${vertical}px`);
});

test('D8: summary table stays inside the horizontal-scroll wrapper', () => {
  const html = rollForwardTableHtml([{
    customerName: 'Test Customer', mohalla: 'Test Mohalla', openingCents: 100000,
    chargesCents: 12345600, paymentsCents: 11111100, concessionsCents: 2222200,
    computedCents: 1333300, reportedCents: 1333300, reconciles: true, differenceCents: 0,
  }]);
  assert.ok(html.includes('<div class="table-scroll">') && html.includes('roll-forward-table'));
});

test('D8: per-customer detail tables wrap in .table-scroll too', () => {
  const html = rollForwardHtml({
    customerName: 'Test Customer', mohalla: 'Test Mohalla', month: '2026-11',
    openingCents: 100000, chargesCents: 100000, paymentsCents: 0, concessionsCents: 0,
    computedCents: 200000, reportedCents: 200000, reconciles: true, differenceCents: 0,
    charges: [{ label: 'Test bill', sourceId: 'BILL-001', amountCents: 100000 }],
    payments: [], concessions: [], unusableLines: [],
  });
  assert.ok(html.includes('<div class="table-scroll">'));
});

// --- C4: 'Plan 67' code leak gone ---------------------------------------------
test('C4: rendered "Plan 67 checklist" string gone, replacement present', () => {
  assert.ok(!appJs.includes('Close the month on the Plan 67 checklist first'));
  assert.ok(appJs.includes('Close the month on the Month-end close checklist first'));
});

// --- budgets pinned by this item ---------------------------------------------
test('budgets: components.css stays hex-free; base .primary-button untouched', () => {
  assert.ok(!/#[0-9a-fA-F]{3,6}\b/.test(componentsCss.replace(/\/\*[\s\S]*?\*\//g, '')));
  assert.match(stylesCss, /\.primary-button\{[^}]*background:var\(--green\);color:white/);
});
