// Delinquency Recovery Pipeline redesign (2026-11-24, user screenshot):
// (a) the three pills clipped ("Top D...") — the header is now stacked so
//     the pills get the full ~314px card width and wrap to 2 clean rows;
// (b) the top sector read "Unassigned" while PKR 9,000 was overdue — the
//     pipeline read only c.area and ignored c.mohalla (covered in
//     tests/dashboard.test.js); (c) Pending Works said "Nothing pending"
//     while 6 customers were delinquent — it is a manual-tasks store, so
//     it is relabelled "Manual tasks"; (d) the card could bleed past the
//     viewport at 360px (1fr = minmax(auto, 1fr) vs the 560-wide SVG
//     viewBox) — scoped min-width: 0 guards + the SVG value label is
//     clamped inside the viewBox. Static structural assertions + a width
//     budget (no jsdom/layout harness exists in the repo).
// Fixture values are generic placeholders, never the screenshot's figures.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { renderDelinquencyPipelineSvg } from '../dashboard-charts.js';
import { DELINQUENCY_STAGES } from '../dashboard.js';

const { TRANSLATIONS, t } = await import('../nav-language.js');

const indexHtml = fs.readFileSync(path.resolve('./index.html'), 'utf-8');
const dashboardCss = fs.readFileSync(path.resolve('./dashboard.css'), 'utf-8');
const chartsSrc = fs.readFileSync(path.resolve('./dashboard-charts.js'), 'utf-8');
const appSrc = fs.readFileSync(path.resolve('./app.js'), 'utf-8');

function ruleBlock(css, selector) {
  const i = css.indexOf(selector);
  if (i < 0) throw new Error(`selector not found: ${selector}`);
  const open = css.indexOf('{', i);
  let depth = 0;
  for (let j = open; j < css.length; j++) {
    if (css[j] === '{') depth++;
    else if (css[j] === '}') { depth--; if (depth === 0) return css.slice(open + 1, j); }
  }
  throw new Error(`unbalanced rule: ${selector}`);
}

// ---------- (a) Pills: stacked header, full-width wrap ----------

test('delinquency header is stacked (title on top, pills below at full width)', () => {
  const at = indexHtml.indexOf('chart-card-delinquency');
  assert.ok(at > 0, 'delinquency card missing');
  const header = indexHtml.slice(at, at + 400);
  assert.ok(
    /class="chart-card-header chart-card-header-flex chart-card-header--stacked"/.test(header),
    'delinquency header must carry chart-card-header--stacked',
  );
  const stacked = ruleBlock(dashboardCss, '.chart-card-header-flex.chart-card-header--stacked');
  assert.ok(/flex-direction:\s*column/.test(stacked), 'stacked header must be a column');
  assert.ok(/align-items:\s*stretch/.test(stacked), 'stacked header children must stretch');
});

test('delinquency pills wrap instead of scrolling, all three present in order', () => {
  const block = ruleBlock(dashboardCss, '.chart-card-delinquency .chart-actions-scroll');
  assert.ok(/flex-wrap:\s*wrap/.test(block), 'pills row must wrap');
  assert.ok(/overflow-x:\s*visible/.test(block), 'pills row must not scroll');
  assert.ok(!/overflow-x:\s*auto/.test(block), 'no hidden-scrollbar scroll row');
  const card = indexHtml.slice(indexHtml.indexOf('chart-card-delinquency'));
  const order = ['dashboardOpenDelinquencyModalBtn', 'dashboardOpenDuesAgingBtn', 'dashboardOpenTopDefaultersBtn']
    .map((id) => card.indexOf(id));
  assert.ok(order.every((i) => i > 0), 'all three pill buttons must exist');
  assert.ok(order[0] < order[1] && order[1] < order[2], 'pills must stay in order: Recovery, Dues Aging, Top Defaulters');
  // Width budget at the 11px floor (prep measurement): one row ~391px
  // cannot fit the ~314px card content width at 360px, so the wrap is
  // the fix — the stacked header gives the pills the full card width.
  assert.ok(chartsSrc.includes('chart-card-header--stacked') === false, 'stacking is HTML/CSS only, no JS change');
});

// ---------- (d) Card bleed: scoped min-width guards + label clamp ----------

test('delinquency card and its flex children can shrink below intrinsic width', () => {
  const card = ruleBlock(dashboardCss, '.chart-card-delinquency {');
  assert.ok(/min-width:\s*0/.test(card), 'grid item must allow min-width: 0');
  const children = ruleBlock(dashboardCss, '.chart-card-delinquency .chart-with-topbar');
  assert.ok(/min-width:\s*0/.test(children), 'topbar/container must allow min-width: 0');
  assert.ok(dashboardCss.includes('.chart-card-delinquency .chart-svg-container'),
    'container guard must be scoped to the delinquency card');
});

test('SVG value labels stay inside the 560-wide viewBox at worst case', () => {
  // Worst case: one stage holds the maximum (full 300px bar) with the
  // longest label the format can produce (2-digit count, 8-digit amount).
  const fixture = {
    totalDelinquentAccounts: 99,
    totalDelinquentDues: 9999999,
    totalExpectedRecovery: 1499999,
    dailyPacingTarget: 50000,
    pipelineHealthStatus: 'Critical Escalation Required',
    topDelinquentAreas: [{ areaName: 'Sector A', totalOverdue: 9999999 }],
    stages: DELINQUENCY_STAGES.map((s, i) => ({
      ...s,
      totalOverdueAmount: [0, 0, 0, 9999999][i],
      subscriberCount: [0, 0, 0, 99][i],
    })),
  };
  const out = renderDelinquencyPipelineSvg(fixture);
  // Value labels look like `99 (PKR 9,999,999)`; stage labels do not.
  const labels = [...out.matchAll(/<text x="([\d.]+)"[^>]*>([\s\S]*?)<\/text>/g)]
    .map((m) => ({ x: Number(m[1]), text: m[2].trim() }))
    .filter((l) => /^\d+ \(.+\)$/.test(l.text));
  assert.ok(labels.length > 0, 'at least one value label must render');
  for (const l of labels) {
    // 6.5px/char is the safe upper bound for 10px bold DM Sans.
    assert.ok(l.x + 6.5 * l.text.length <= 560,
      `value label "${l.text}" at x=${l.x} must end inside the 560 viewBox`);
  }
  assert.ok(chartsSrc.includes('valueLabelX'), 'clamp must live in the renderer');
});

// ---------- (c) Pending Works relabel: manual tasks ----------

test('Pending Works is relabelled Manual tasks in both languages', () => {
  assert.equal(TRANSLATIONS.en.dash_card_pending, 'Manual tasks');
  assert.equal(TRANSLATIONS.ur.dash_card_pending, 'دستی کام');
  assert.equal(t('dash_card_pending', 'en'), 'Manual tasks');
  assert.equal(t('dash_card_pending', 'ur'), 'دستی کام');
});

test('empty manual-tasks text uses a new key; the shared empty text is untouched', () => {
  assert.equal(TRANSLATIONS.en.dash_pending_manual_empty, 'No manual tasks pending');
  assert.equal(TRANSLATIONS.ur.dash_pending_manual_empty, 'کوئی دستی کام زیر التوا نہیں');
  assert.equal(t('dash_pending_manual_empty', 'en'), 'No manual tasks pending');
  assert.equal(t('dash_pending_manual_empty', 'ur'), 'کوئی دستی کام زیر التوا نہیں');
  // dash_pending_empty stays 'Nothing pending': it is shared with the
  // SISP-19 hardware-recovery card, where that wording is correct.
  assert.equal(TRANSLATIONS.en.dash_pending_empty, 'Nothing pending');
  assert.equal(TRANSLATIONS.ur.dash_pending_empty, 'کچھ زیر التوا نہیں');
});

test('pending-works branch uses the new key; hardware recovery keeps the old one', () => {
  assert.ok(appSrc.includes("t('dash_pending_manual_empty')"),
    'pending-works empty case must use dash_pending_manual_empty');
  const emptyUses = (appSrc.match(/t\('dash_pending_empty'\)/g) || []).length;
  assert.equal(emptyUses, 1, 'dash_pending_empty must survive in exactly one place (hardware recovery)');
  const section = indexHtml.slice(indexHtml.indexOf('id="pendingWorksSection"'));
  assert.ok(section.includes('>Manual tasks<'), 'static title fallback must read Manual tasks');
  assert.ok(section.includes('>No manual tasks pending<'), 'static value fallback must read No manual tasks pending');
  assert.ok(section.includes('data-i18n="dash_card_pending"'), 'i18n key binding must stay');
});
