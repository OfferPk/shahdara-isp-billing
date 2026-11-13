// Dashboard stat cards redesign (owner request, 2026-10-29): ONE shared
// clean card (.ds-stat) layered on top of the existing dashboard card
// classes — tokens only, icon tile + label + big value, nothing renamed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../components.css', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const block = css.slice(css.indexOf('Dashboard stat cards'));

test('shared .ds-stat card is token-built with the reference geometry', () => {
  assert.ok(block.length > 0, 'components.css carries the stat-card block');
  assert.ok(block.includes('.ds-stat {'), 'base card class');
  assert.ok(block.includes('background: var(--surface)'), 'theme surface, no hardcoded white');
  assert.ok(block.includes('border: 1px solid var(--line)'), 'thin theme border');
  assert.ok(block.includes('border-radius: var(--radius-lg)'), 'generous radius (18px token)');
  assert.ok(block.includes('box-shadow: var(--elevation-1)'), 'soft token shadow');
  assert.ok(block.includes('.ds-stat__icon'), 'icon tile');
  assert.ok(block.includes('.ds-stat__body'), 'text column');
  const noComments = block.replace(/\/\*[\s\S]*?\*\//g, '');
  const hexes = noComments.match(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g) || [];
  assert.deepEqual(hexes, [], `no hard-coded hex in the stat-card block (found ${hexes})`);
});

test('accent modifiers colour only the icon tile, from tokens', () => {
  for (const [mod, token] of [['brand', '--color-brand-500'], ['paid', '--color-paid'], ['info', '--color-info'], ['pending', '--color-pending'], ['overdue', '--color-overdue'], ['whatsapp', '--color-whatsapp']]) {
    assert.ok(block.includes(`.ds-stat--${mod} .ds-stat__icon { background: var(${token}); }`), `${mod} tile uses ${token}`);
  }
  assert.ok(block.includes('[data-theme="dark"] .ds-stat'), 'dark-mode surface rule present');
});

test('KPI strip cards carry the shared card, a tile and their original hooks', () => {
  // Home Dashboard overhaul: the strip is 5 cards now — Today,
  // Month, Total Dues (all id'd) plus Cash in Hand and Active
  // Subscribers, whose wrapper ids were removed to respect the
  // no-new-element-id fence. The deleted Customers-with-Dues card
  // survives only as the Total Dues sub-line (same id, reused);
  // the Advance Held card moved to Collect (id kept).
  for (const id of ['kpiCardToday', 'kpiCardMonth', 'kpiCardDues']) {
    assert.ok(html.includes(`ds-stat`), 'ds-stat applied');
    const cardAt = html.indexOf(`id="${id}"`);
    const cardTag = html.slice(html.lastIndexOf('<div', cardAt), cardAt);
    assert.ok(cardTag.includes('ds-stat'), `${id} carries .ds-stat`);
  }
  const advanceAt = html.indexOf('id="kpiCardAdvance"');
  assert.ok(advanceAt >= 0, 'Advance Held card exists in Collect');
  assert.ok(html.slice(html.lastIndexOf('<div', advanceAt), advanceAt).includes('ds-stat'), 'kpiCardAdvance carries .ds-stat');
  for (const valId of ['kpiTodayCollection', 'kpiMonthCollectionBilled', 'kpiTotalDue', 'kpiCustomersWithDues', 'kpiAdvanceHeld']) {
    assert.ok(html.includes(`id="${valId}"`), `${valId} value hook unchanged`);
  }
  const strip = html.slice(html.indexOf('id="homeKpiStrip"'), html.indexOf('id="homePrimaryActions"'));
  assert.equal((strip.match(/home-kpi-card[^"]*ds-stat/g) || []).length, 5, 'all 5 KPI cards adopted');
  assert.equal((html.match(/home-kpi-card[^"]*ds-stat/g) || []).length, 6, 'the Collect Advance card is the sixth');
  assert.ok(block.includes('white-space: normal'), 'KPI values wrap instead of truncating');
});

test('every dashboard summary card adopted the shared card; plain KPI cards got a tile', () => {
  const articles = html.match(/<article class="summary-card [^"]*">/g) || [];
  // Home Dashboard overhaul: 51 -> 32 — the 19 deleted articles
  // are the duplicate bottom-KPI-grid cards (14 tail metrics + the
  // today card + 3 duplicate metric cards + the standalone Cash in
  // Hand section). Every surviving article still carries the shared
  // card and an accent.
  // Subscriber Count & Tab Isolation: 32 -> 30 — the 2 deleted
  // articles are the Receipt Verification + Field Tools cards, dropped
  // per D2 (their modals live on via the More menu). The 22 moved
  // cards still count; they only changed homes.
  assert.ok(articles.length >= 30, `summary cards present (${articles.length})`);
  for (const tag of articles) {
    assert.ok(tag.includes('ds-stat'), `shared card applied: ${tag}`);
    assert.ok(/ds-stat--(brand|paid|info|pending|overdue|whatsapp)/.test(tag), `accent set: ${tag}`);
  }
  // Collect Tab polish: the icon is now one level deeper — the §1
  // single-row header wraps icon + title + KPI in a .ds-stat-head
  // flex row, so the tile is the head's first child, not the
  // article's. The count is still 2: QC-5 and QC-6 are the only
  // plain KPI summary cards carrying an icon tile.
  const tiled = html.match(/<article class="summary-card [^"]*">(?:<div class="ds-stat-head">)?<span class="ds-stat__icon"/g) || [];
  // Plan 471: the count is 19, not 18 — the new dashboard today card
  // is a plain KPI summary card with an icon tile, same shape as the
  // today's-collection card it follows.
  // QC-5: the count is 20, not 19 — the new Today's Field Recovery
  // card is a plain KPI summary card with an icon tile, same shape as
  // the today card it follows.
  // QC-6: the count is 21, not 20 — the new Collection insights card
  // is a plain KPI summary card with an icon tile, same shape as the
  // QC-5 card it follows.
  // Home Dashboard overhaul: the count is 2, not 21 — all 19
  // deleted duplicate-grid articles were tiled KPI cards; their
  // content moved to the KPI strip (home-kpi-card, pinned above).
  assert.equal(tiled.length, 2, 'the 2 plain KPI summary cards carry an icon tile');
});

test('summary/today geometry parity is kept on the same tokens', () => {
  assert.ok(block.includes('.home-today-card {'), 'today card geometry rule');
  assert.ok(/\.home-today-card \{\s*border-radius: var\(--radius-lg\);\s*box-shadow: var\(--elevation-1\);/.test(block), 'today card matches stat-card radius + shadow');
  assert.ok(block.includes('[data-theme="dark"] .home-today-card'), 'dark parity rule');
});
