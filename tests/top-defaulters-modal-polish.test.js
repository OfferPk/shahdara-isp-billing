// Top Defaulters modal polish (2026-11-22, user decision): clipped
// header/close + KPI cards, name/bar collision in the debt-concentration
// chart, duplicate nested wrapper, legend crowding, uneven Actions drawer
// + semantic tints. Pins the fixed state; the stability tests pin what
// must survive untouched. Synthetic fixture only — no real customer
// names, no realistic phone numbers, no figures from any screenshot.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { renderTopDefaultersSvg } from '../dashboard-top-defaulters.js';

const html = fs.readFileSync(path.resolve('./index.html'), 'utf-8');
const stylesCss = fs.readFileSync(path.resolve('./styles.css'), 'utf-8');
const darkCss = fs.readFileSync(path.resolve('./dark-contrast.css'), 'utf-8');
const controller = fs.readFileSync(path.resolve('./dashboard-top-defaulters.js'), 'utf-8');
const tokensCss = fs.readFileSync(path.resolve('./tokens.css'), 'utf-8');
const lang = fs.readFileSync(path.resolve('./nav-language.js'), 'utf-8');

// Synthetic fixture: 3 accounts, mixed risk, one deliberately long name
// (28 chars — the old trim cut names to 14 chars + ellipsis).
const fixture = {
  accounts: [
    { id: 'CUST-A1', rank: 1, name: 'Longname Customer Alpha Beta', area: 'Shahdara', unpaidMonthsCount: 3, totalOutstanding: 4200, riskCategory: 'critical' },
    { id: 'CUST-A2', rank: 2, name: 'Medium Length Name Here', area: 'Shahdara', unpaidMonthsCount: 2, totalOutstanding: 2700, riskCategory: 'high' },
    { id: 'CUST-A3', rank: 3, name: 'Short Name', area: 'Shahdara', unpaidMonthsCount: 1, totalOutstanding: 900, riskCategory: 'moderate' },
  ],
  metrics: { topConcentrationPercent: 100, topDefaultersDues: 7800, totalReceivablesDues: 7800 },
};
const svg = renderTopDefaultersSvg(fixture);

function modalSlice() {
  const start = html.indexOf('id="topDefaultersModal"');
  const end = html.indexOf('<dialog', start + 1);
  return html.slice(start, end === -1 ? undefined : end);
}

// CSS rule bodies for rules whose selector text contains any needle.
function cssBodies(needles) {
  const out = [];
  const re = /([^{}]+)\{([^}]*)\}/g;
  let m;
  while ((m = re.exec(stylesCss)) !== null) {
    if (needles.some((n) => m[1].includes(n))) out.push(m[2]);
  }
  return out.join(' ');
}

function svgRows() {
  const chunks = svg.split('<g class="defaulter-svg-row"').slice(1);
  return chunks.map((c) => {
    const nameY = (/ <text x="18" y="(\d+)"[^>]*font-size="12" font-weight="600"/.exec(c)
      || /<text x="18" y="(\d+)"/.exec(c) || [])[1];
    const bar = /<rect x="(\d+)" y="(\d+)" width="(\d+)" height="(\d+)"[^>]*fill="url\(#defaulter/.exec(c);
    const amountTag = /<text[^>]*>PKR [\d,]+<\/text>/.exec(c);
    return {
      nameY: nameY ? Number(nameY) : null,
      barX: bar ? Number(bar[1]) : null,
      barY: bar ? Number(bar[2]) : null,
      barW: bar ? Number(bar[3]) : null,
      barH: bar ? Number(bar[4]) : null,
      amountEnd: amountTag ? /text-anchor="end"/.test(amountTag[0]) : false,
    };
  });
}
const rows = svgRows();

test('modal polish: header has pt-4 top padding, sticks at top 0, and scrolled sections clear it', () => {
  const header = /\.top-defaulters-modal\s+\.billing-modal-header\s*\{([^}]*)\}/.exec(stylesCss);
  assert.ok(header, 'no .top-defaulters-modal .billing-modal-header rule');
  const pad = /padding-top:\s*(\d+)px/.exec(header[1]);
  assert.ok(pad && Number(pad[1]) >= 16, `header top padding must be >= 16px (pt-4) — got: ${header[1]}`);
  assert.ok(/top:\s*0(!important)?/.test(header[1]),
    'the modal header must override the generic sticky top:-16px with top: 0');
  const dialogRule = /\.top-defaulters-modal\s*\{([^}]*)\}/.exec(stylesCss);
  const dialogPad = dialogRule && Number((/scroll-padding-top:\s*(\d+)px/.exec(dialogRule[1]) || [])[1] || 0) >= 80;
  const kpiMargin = /\.defaulters-kpi-grid\s*\{[^}]*scroll-margin-top:\s*(\d+)px/.test(stylesCss);
  const chartMargin = /#topDefaultersChartContainer[^{]*\{[^}]*scroll-margin-top:\s*(\d+)px/.test(stylesCss);
  assert.ok(dialogPad || kpiMargin || chartMargin,
    'no scroll-padding-top on the dialog and no scroll-margin-top on the KPI grid / chart container');
});

test('modal polish: chart rows are stacked — full name on line 1, amount right, full-width bar below', () => {
  assert.equal(rows.length, 3, `expected 3 chart rows, got ${rows.length}`);
  assert.ok(svg.includes('Longname Customer Alpha Beta'),
    'the 28-char name must render in full on line 1 (the old trim cut it to 14 chars + …)');
  const widest = Math.max(...rows.map((r) => r.barW || 0));
  assert.ok(widest >= 300, `widest bar must be >= 300px full-width — got ${widest}`);
  assert.ok(rows.every((r) => r.amountEnd), 'every amount label must use text-anchor="end"');
  for (const [i, r] of rows.entries()) {
    assert.ok(r.nameY !== null && r.barY !== null && r.barY > r.nameY,
      `row ${i + 1}: bar y (${r.barY}) must be below the name baseline (${r.nameY})`);
  }
  const pitch = rows[1].barY - rows[0].barY;
  assert.ok(pitch >= 40, `row pitch must be >= 40px for the stacked layout — got ${pitch}`);
});

test('modal polish: the duplicate outer chart wrapper card and title are gone; the SVG keeps its own card', () => {
  const modal = modalSlice();
  assert.ok(!modal.includes('defaulters-chart-wrapper'),
    'the outer .defaulters-chart-wrapper div must be removed from the modal');
  assert.ok(!modal.includes('Top Defaulters Debt Concentration Chart'),
    'the outer h4 title must be removed (the SVG keeps its own title)');
  assert.ok(svg.includes('Top Defaulters Debt Concentration'),
    'the chart SVG must keep its own title text');
  assert.ok(svg.includes('<rect x="0" y="0"'),
    'the chart SVG must keep its own background card rect');
});

test('modal polish: the legend has breathing room — a divider above it and a wider gap from the last row', () => {
  const legendY = (/ <text x="36" y="(\d+)">Critical/.exec(svg)
    || /<text x="36" y="(\d+)">Critical/.exec(svg) || [])[1];
  assert.ok(legendY, 'legend Critical text not found in the SVG');
  const last = rows[rows.length - 1];
  const lastBarBottom = last.barY + last.barH;
  const gap = Number(legendY) - lastBarBottom;
  assert.ok(gap >= 24, `legend baseline must sit >= 24px below the last bar bottom — got ${gap}`);
  const dividers = [...svg.matchAll(/<line x1="20" y1="(\d+)" x2="[^"]+" y2="\d+"[^>]*>/g)]
    .map((m) => Number(m[1]));
  assert.ok(dividers.some((y) => y > lastBarBottom && y < Number(legendY)),
    `no divider line between the last bar bottom (${lastBarBottom}) and the legend (${legendY})`);
});

test('modal polish: Send Final Pre-Lock is a full-width WhatsApp-green primary button', () => {
  const modal = modalSlice();
  assert.ok(modal.includes('td-prelock-btn'),
    'the prelock button must carry the td-prelock-btn class');
  const rule = cssBodies(['.td-prelock-btn']);
  assert.ok(rule.length > 0, 'no .td-prelock-btn rule in styles.css');
  assert.ok(/background:\s*linear-gradient\(90deg,\s*#25d366,\s*#128c7e\)/.test(rule),
    'prelock must use the WhatsApp gradient linear-gradient(90deg, #25d366, #128c7e) — lowercase hex only');
  assert.ok(/width:\s*100%/.test(rule), 'prelock must be full-width');
  assert.ok(/min-height:\s*44px/.test(rule), 'prelock must be at least 44px tall');
  assert.ok(/color:\s*#ffffff/.test(rule), 'prelock text must be white');
  assert.ok(/border-radius:\s*12px/.test(rule), 'prelock must be rounded-xl (12px)');
  assert.ok(/font-weight:\s*600/.test(rule), 'prelock must be semibold');
});

test('modal polish: the remaining 7 action buttons share one balanced 2-column grid, no inner scrollbar', () => {
  const modal = modalSlice();
  assert.ok(!modal.includes('>Follow-up<'), 'Follow-up group label must be gone (flat grid)');
  assert.ok(!modal.includes('>Print / Export<'), 'Print / Export group label must be gone (flat grid)');
  assert.ok(modal.includes('td-actions-grid'), 'the flat .td-actions-grid container must exist');
  const gridStart = modal.indexOf('td-actions-grid');
  const gridEnd = modal.indexOf('</div>', gridStart);
  const gridHtml = modal.slice(gridStart, gridEnd === -1 ? undefined : gridEnd);
  for (const id of ['topDefaultersHideContactedBtn', 'topDefaultersLockDueBtn', 'topDefaultersZoneSheetBtn',
    'topDefaultersPrintA4Btn', 'topDefaultersPrintThermalBtn', 'topDefaultersExportCsvBtn',
    'topDefaultersCopyBriefingBtn']) {
    assert.ok(gridHtml.includes(`id="${id}"`), `${id} must sit inside .td-actions-grid`);
  }
  const rule = cssBodies(['.td-actions-grid']);
  assert.ok(/grid-template-columns:\s*(1fr 1fr|repeat\(2,)/.test(rule),
    `td-actions-grid must be a 2-column grid — got: ${rule}`);
  assert.ok(!/overflow-y/.test(rule), 'the grid itself must not own a scrollbar');
  const btnRule = cssBodies(['.td-actions-grid .secondary-button', '.td-actions-grid button']);
  assert.ok(/min-height:\s*44px/.test(btnRule), `grid buttons must share min-height: 44px — got: ${btnRule}`);
  assert.ok(modal.includes('td-action-wide'), 'Copy Briefing must carry the td-action-wide full-row class');
  const wideRule = cssBodies(['.td-action-wide']);
  assert.ok(/grid-column:\s*1\s*\/\s*-1/.test(wideRule), 'td-action-wide must span both columns');
});

test('modal polish: semantic tints — Lock Due rose, Thermal blue, Router Scripts rose + emerald, equal height', () => {
  const lockRule = cssBodies(['.td-btn-lock-due']);
  assert.ok(/background:\s*var\(--qc-rose-bg\)/.test(lockRule), 'Lock Due must use --qc-rose-bg');
  assert.ok(/color:\s*var\(--qc-rose-text\)/.test(lockRule), 'Lock Due must use --qc-rose-text');
  assert.ok(/border(-color)?:[^;]*var\(--qc-rose-border\)/.test(lockRule), 'Lock Due must use --qc-rose-border');
  const thermalRule = cssBodies(['.td-btn-thermal']);
  assert.ok(/background:\s*var\(--qc-blue-bg\)/.test(thermalRule), 'Thermal must use --qc-blue-bg');
  assert.ok(/color:\s*var\(--qc-blue-text\)/.test(thermalRule), 'Thermal must use --qc-blue-text');
  assert.ok(/border(-color)?:[^;]*var\(--qc-blue-border\)/.test(thermalRule), 'Thermal must use --qc-blue-border');
  const lockScriptRule = cssBodies(['.td-btn-mikrotik-lock']);
  assert.ok(/background:\s*var\(--qc-rose-bg\)/.test(lockScriptRule), 'MikroTik Lock must use --qc-rose-bg');
  assert.ok(/color:\s*var\(--qc-rose-text\)/.test(lockScriptRule), 'MikroTik Lock must use --qc-rose-text');
  const restoreRule = cssBodies(['.td-btn-mikrotik-restore']);
  assert.ok(/background:\s*var\(--qc-mint-bg\)/.test(restoreRule), 'MikroTik Restore must use --qc-mint-bg');
  assert.ok(/color:\s*var\(--qc-mint-strong-text\)/.test(restoreRule), 'MikroTik Restore must use --qc-mint-strong-text');
  assert.ok(/border(-color)?:[^;]*var\(--qc-mint-border\)/.test(restoreRule), 'MikroTik Restore must use --qc-mint-border');
  const modal = modalSlice();
  assert.ok(modal.includes('defaulters-action-group--wide'), 'Router Scripts group must stay full-width');
  assert.ok(/min-height:\s*44px/.test(lockScriptRule) && /min-height:\s*44px/.test(restoreRule),
    'both Router Scripts buttons must share min-height: 44px');
  // Dark mode: the prelock gradient becomes the same dark teal as the
  // other WhatsApp buttons (buttons-tint precedent), reusing hex that
  // already occurs in dark-contrast.css.
  assert.ok(/\[data-theme="dark"\] \.td-prelock-btn\s*\{[^}]*background:\s*#075e54/.test(darkCss),
    'dark mode must give the prelock button the #075e54 teal');
  assert.ok(/\[data-theme="dark"\] \.td-prelock-btn\s*\{[^}]*border-color:\s*#0b7a6c/.test(darkCss),
    'dark mode prelock border must be #0b7a6c');
});

test('modal polish: the header ✕ is the only close (id + classes + ✕ text)', () => {
  const modal = modalSlice();
  assert.match(modal, /<button id="closeTopDefaultersModalBtn" class="close-btn td-close-btn"[^>]*>✕<\/button>/);
  assert.ok(!modal.includes('id="closeTopDefaultersSecondaryBtn"'), 'bottom Close must stay removed');
});

test('modal polish: all 10 action buttons stay inside the collapsed Actions <details>', () => {
  const modal = modalSlice();
  const detailsStart = modal.indexOf('<details class="defaulters-actions-details"');
  assert.ok(detailsStart >= 0, 'actions <details> must exist');
  const detailsTag = modal.slice(detailsStart, modal.indexOf('>', detailsStart));
  assert.ok(!detailsTag.includes(' open'), 'actions drawer must start collapsed');
  const detailsEnd = modal.indexOf('</details>', detailsStart);
  for (const id of ['topDefaultersExportCsvBtn', 'topDefaultersCopyBriefingBtn', 'topDefaultersLockDueBtn',
    'topDefaultersPrelockNoticeBtn', 'topDefaultersHideContactedBtn', 'topDefaultersMikrotikLockBtn',
    'topDefaultersMikrotikRestoreBtn', 'topDefaultersPrintA4Btn', 'topDefaultersPrintThermalBtn',
    'topDefaultersZoneSheetBtn']) {
    const pos = modal.indexOf(`id="${id}"`);
    assert.ok(pos > detailsStart && pos < detailsEnd, `${id} must stay inside the actions <details>`);
  }
  assert.ok(modal.indexOf('id="topDefaultersPrelockNoticeBtn"') < modal.indexOf('id="topDefaultersHideContactedBtn"'));
  assert.ok(modal.indexOf('id="topDefaultersHideContactedBtn"') < modal.indexOf('id="topDefaultersLockDueBtn"'));
});

test('modal polish: chart keeps the 380 viewBox, legend strings and token fills', () => {
  assert.ok(svg.includes('viewBox="0 0 380 '), 'chart viewBox must stay 380 wide');
  for (const s of ['Critical (3m+ / 60d+)', 'High (2m / 30d+)', 'Moderate (1m)']) {
    assert.ok(svg.includes(s), `legend must keep "${s}"`);
  }
  for (const t of ['var(--td-risk-critical)', 'var(--td-risk-high)', 'var(--td-risk-moderate)']) {
    assert.ok(svg.includes(t), `risk colour must keep coming from ${t}`);
  }
  assert.ok(!svg.includes('fill="#ef4444"'), 'amount/telemetry fills must not go back to raw hex');
  assert.ok(svg.includes('Top Debt:'), 'concentration badge must survive');
});

test('modal polish: compact header, KPI 2x2, 44px bar and 45dvh drawer cap are untouched', () => {
  assert.ok(stylesCss.includes('.top-defaulters-modal .billing-modal-header h2'), 'compact header h2 rule must exist');
  assert.ok(stylesCss.includes('font-size: 16px !important'), 'compact header h2 must stay 16px');
  assert.ok(stylesCss.includes('.top-defaulters-modal .urdu-subtitle'), 'subtitle one-line rule must exist');
  assert.ok(stylesCss.includes('grid-template-columns: 1fr 1fr'), 'KPI grid must stay 2x2 on phones');
  assert.ok(stylesCss.includes('min-height: 44px'), 'Actions summary bar must stay the slim 44px bar');
  assert.ok(stylesCss.includes('max-height: 45dvh'), 'open Actions drawer must stay capped at 45dvh');
});

test('modal polish: no new i18n key or token is needed — every label and tint token already exists', () => {
  assert.ok(lang.includes("prelock_open_btn: '📲 Send Final Pre-Lock WhatsApp Notice'"), 'prelock label must exist');
  assert.ok(lang.includes('cct_hide_contacted_today'), 'hide-contacted label must exist');
  assert.ok(lang.includes('zsheet_open_btn'), 'zone-sheet label must exist');
  for (const t of ['--qc-rose-bg:', '--qc-rose-border:', '--qc-rose-text:',
    '--qc-blue-bg:', '--qc-blue-border:', '--qc-blue-text:',
    '--qc-mint-bg:', '--qc-mint-border:', '--qc-mint-strong-text:']) {
    assert.ok(tokensCss.includes(t), `token ${t} must exist`);
  }
});

test('modal polish: the chart still renders every account, amounts and the footer totals', () => {
  assert.ok(svg.includes('Short Name'), 'chart must render the short name in full');
  for (const amt of ['PKR 4,200', 'PKR 2,700', 'PKR 900']) {
    assert.ok(svg.includes(amt), `chart must render ${amt}`);
  }
  for (const rank of ['#1 ', '#2 ', '#3 ']) {
    assert.ok(svg.includes(rank), `chart must render rank ${rank.trim()}`);
  }
  assert.ok(svg.includes('Top Accounts Dues:'), 'footer totals line must survive');
  const emptySvg = renderTopDefaultersSvg({ accounts: [], metrics: {} });
  assert.ok(emptySvg.includes('No delinquent accounts on record'), 'empty state must survive');
});

test('modal polish: the modal controller still opens, closes and wires every action', () => {
  assert.ok(controller.includes('showModalOnce'), 'open-once guard must survive');
  assert.ok(controller.includes("document.getElementById('dashboardOpenTopDefaultersBtn')"), 'analytics pill opener must survive');
  assert.ok(controller.includes("document.getElementById('quickActionTopDefaulters')"), 'quick-action opener must survive');
  assert.ok(controller.includes('closeTopDefaultersModalBtn'), 'close-button wiring must survive');
  assert.ok(controller.includes('topDefaultersPrelockNoticeBtn'), 'prelock wiring must survive');
  assert.ok(controller.includes('topDefaultersMikrotikLockBtn'), 'mikrotik-lock wiring must survive');
  assert.ok(controller.includes('topDefaultersMikrotikRestoreBtn'), 'mikrotik-restore wiring must survive');
  assert.ok(controller.includes('hideContactedOnly = !hideContactedOnly'), 'hide-contacted toggle must survive');
  assert.ok(controller.includes('`🔴 Lock Due (15th+) · ${count}`'), 'Lock Due live count must survive');
  assert.ok(controller.includes('chartContainer.innerHTML = renderTopDefaultersSvg(currentData)'), 'chart render call must survive');
});

test('modal polish: the wrapper CSS rule stays — two other modals share the class', () => {
  // Parent correction (2026-11-22): .defaulters-chart-wrapper is also
  // used by #areaCollectionsModal ("Area Revenue Performance
  // Comparison") and #packageRevenueModal ("Package Revenue Share &
  // Portfolio Distribution"), so the rule must NOT be deleted even
  // though this modal no longer uses the wrapper div.
  assert.ok(stylesCss.includes('.defaulters-chart-wrapper'), 'wrapper CSS rule must stay for the other modals');
  assert.ok(html.includes('id="areaCollectionsModal"'), 'area-collections modal must still exist');
  assert.ok(html.includes('id="packageRevenueModal"'), 'package-revenue modal must still exist');
  const areaAt = html.indexOf('id="areaCollectionsModal"');
  const pkgAt = html.indexOf('id="packageRevenueModal"');
  assert.ok(html.indexOf('defaulters-chart-wrapper', areaAt) > areaAt
    && html.indexOf('defaulters-chart-wrapper', areaAt) < pkgAt,
    'area-collections modal must still use the wrapper class');
  assert.ok(html.indexOf('defaulters-chart-wrapper', pkgAt) > pkgAt,
    'package-revenue modal must still use the wrapper class');
});
