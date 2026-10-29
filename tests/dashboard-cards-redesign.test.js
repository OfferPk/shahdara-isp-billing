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
  for (const id of ['kpiCardToday', 'kpiCardMonth', 'kpiCardDues', 'kpiCardDefaulters']) {
    assert.ok(html.includes(`ds-stat`), 'ds-stat applied');
    const cardAt = html.indexOf(`id="${id}"`);
    const cardTag = html.slice(html.lastIndexOf('<div', cardAt), cardAt);
    assert.ok(cardTag.includes('ds-stat'), `${id} carries .ds-stat`);
  }
  for (const valId of ['kpiTodayCollection', 'kpiMonthCollectionBilled', 'kpiTotalDue', 'kpiCustomersWithDues']) {
    assert.ok(html.includes(`id="${valId}"`), `${valId} value hook unchanged`);
  }
  assert.equal((html.match(/home-kpi-card[^"]*ds-stat/g) || []).length, 4, 'all 4 KPI cards adopted');
  assert.ok(block.includes('white-space: normal'), 'KPI values wrap instead of truncating');
});

test('every dashboard summary card adopted the shared card; plain KPI cards got a tile', () => {
  const articles = html.match(/<article class="summary-card [^"]*">/g) || [];
  assert.ok(articles.length >= 36, `summary cards present (${articles.length})`);
  for (const tag of articles) {
    assert.ok(tag.includes('ds-stat'), `shared card applied: ${tag}`);
    assert.ok(/ds-stat--(brand|paid|info|pending|overdue|whatsapp)/.test(tag), `accent set: ${tag}`);
  }
  const tiled = html.match(/<article class="summary-card [^"]*"><span class="ds-stat__icon"/g) || [];
  assert.equal(tiled.length, 18, 'the 18 plain KPI summary cards carry an icon tile');
});

test('summary/today geometry parity is kept on the same tokens', () => {
  assert.ok(block.includes('.home-today-card {'), 'today card geometry rule');
  assert.ok(/\.home-today-card \{\s*border-radius: var\(--radius-lg\);\s*box-shadow: var\(--elevation-1\);/.test(block), 'today card matches stat-card radius + shadow');
  assert.ok(block.includes('[data-theme="dark"] .home-today-card'), 'dark parity rule');
});
