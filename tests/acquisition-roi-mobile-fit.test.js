// tests/acquisition-roi-mobile-fit.test.js — Subscriber Acquisition ROI & Payback
// mobile redesign: the 560-wide SVG clipped its end-anchored channel labels
// past the left edge and read at ~5px at 360px. The chart body is now HTML
// rows (names on their own line, CSS bars, wrapping footer), tokenized per
// the approved map. No browser — reads files as text + renders the real
// renderAcquisitionRoiSvg with the screenshot fixture.
// This file does NOT pin parity (no new i18n keys; parity stays 5,223/5,223).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { renderAcquisitionRoiSvg } from '../dashboard-charts.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dcSrc = readFileSync(resolve(ROOT, 'dashboard-charts.js'), 'utf8');
const djSrc = readFileSync(resolve(ROOT, 'dashboard.js'), 'utf8');
const cssSrc = readFileSync(resolve(ROOT, 'dashboard.css'), 'utf8');

// ---- Screenshot fixture (user's 2026-11-22 screenshot, ~360px) ----
// Same numbers/order as the screenshot; generic channel names only.
// Colours are the production values from ACQUISITION_CHANNELS (tokenized
// where an exact token exists; #3b82f6 kept as hex) — the renderer receives
// them via calculateAcquisitionRoiMetrics, which copies ch.color through.
const fixture = {
  totalPortfolioAcquisitions: 68,
  channels: [
    { name: 'Customer Word-of-Mouth', totalAcquisitions: 19, paybackMonths: 1.5, blendedCac: 2200, netRoiPercent: 163.2, velocityStatus: 'Rapid Payback', color: 'var(--color-emerald)' },
    { name: 'Direct Walk-in / Office', totalAcquisitions: 17, paybackMonths: 2, blendedCac: 2800, netRoiPercent: 157.4, velocityStatus: 'Rapid Payback', color: 'var(--color-brand-600)' },
    { name: 'Local Banner & Pamphlet', totalAcquisitions: 17, paybackMonths: 3.2, blendedCac: 4200, netRoiPercent: 46.1, velocityStatus: 'Standard Payback', color: 'var(--td-risk-moderate)' },
    { name: 'Field Technician Referral', totalAcquisitions: 15, paybackMonths: 2.8, blendedCac: 3500, netRoiPercent: 47.6, velocityStatus: 'Rapid Payback', color: '#3b82f6' },
  ],
  fastestPaybackChannel: 'Customer Word-of-Mouth',
  portfolioNetRoiPercent: 74.5,
  totalPortfolioCac: 330600,
  totalPortfolioRealizedRevenue: 576900,
  portfolioAvgPaybackMonths: 2.5,
};
const html = renderAcquisitionRoiSvg(fixture);

// Container width at phone widths (recovery-prep verified arithmetic):
// 360 - 2x14 .dashboard pad - 2x12 region pad - 2x1 region border
//     - 2x10 card pad = 286px; 320px -> 246px.
const CONTAINER = { 360: 286, 320: 246 };
// Text-width model (upper estimates, not browser measurements): DM Sans
// average advance ~0.55em bold at 11px (6.05px/char), ~0.50em at 10px
// (5.0px/char), ~0.55em at 13px (7.15px/char). The fit asserts use the
// WIDE end, so the verdict does not depend on the exact font.
const ADV = { bold13: 7.15, bold11: 6.05, reg11: 5.5, bold10: 5.5 };

test('channel names render as real text on their own line, never end-anchored', () => {
  assert.ok(!html.includes('<svg'), 'no SVG in the output');
  assert.ok(!html.includes('text-anchor="end"'), 'no end-anchored SVG label');
  assert.ok(html.includes('acquisition-roi-rows'), 'rows live in one wrapper div');
  for (const ch of fixture.channels) {
    const esc = ch.name.replace(/&/g, '&amp;');
    assert.ok(html.includes(esc), `name "${ch.name}" present as text`);
    assert.ok(html.includes(`(${ch.totalAcquisitions} subs)`), `subs count for "${ch.name}" present`);
    // The name sits in its own wrapping div (never an SVG text run).
    assert.match(html, new RegExp(`<div class="acquisition-roi-name"><strong>${esc.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}</strong>`));
  }
  assert.equal((html.match(/class="acquisition-roi-row"/g) || []).length, 4, 'four HTML rows');
  // The name line may wrap (it is a block div) — it never clips.
  assert.ok(!/\.acquisition-roi-name\s*\{[^}]*white-space:\s*nowrap/.test(cssSrc), 'name line is not nowrap');
});

test('bar + value + pill fit at 360px (286px container)', () => {
  // Worst fixed widths (wide model): longest value + longest pill + gaps.
  const valueW = Math.max(...fixture.channels.map((c) => `${c.paybackMonths}m · ${c.netRoiPercent > 0 ? '+' : ''}${c.netRoiPercent}% ROI`.length)) * ADV.bold11;
  const pillW = 'STANDARD'.length * ADV.bold10 + 16; // + 2x8px pill padding
  const gaps = 2 * 8; // .acquisition-roi-bar-row gap
  const fixed = valueW + pillW + gaps;
  const barW = CONTAINER[360] - fixed;
  assert.ok(barW >= 12, `bar keeps >=12px at 360px (fixed ${fixed.toFixed(0)}px, bar ${barW.toFixed(0)}px of ${CONTAINER[360]}px)`);
  // The bar flexes (it is not a fixed pixel width) and the value/pill never wrap.
  assert.match(cssSrc, /\.acquisition-roi-bar\s*\{[^}]*flex:\s*1 1 auto;[^}]*min-width:\s*0;/);
  assert.match(cssSrc, /\.acquisition-roi-bar-fill\s*\{[^}]*min-width:\s*12px;/);
  assert.match(cssSrc, /\.acquisition-roi-value\s*\{[^}]*white-space:\s*nowrap;/);
  assert.match(cssSrc, /\.acquisition-roi-pill\s*\{[^}]*white-space:\s*nowrap;/);
});

test('bar + value + pill fit at 320px (246px container)', () => {
  const valueW = Math.max(...fixture.channels.map((c) => `${c.paybackMonths}m · ${c.netRoiPercent > 0 ? '+' : ''}${c.netRoiPercent}% ROI`.length)) * ADV.bold11;
  const pillW = 'STANDARD'.length * ADV.bold10 + 16;
  const gaps = 2 * 8;
  const barW = CONTAINER[320] - (valueW + pillW + gaps);
  assert.ok(barW >= 12, `bar keeps >=12px at 320px (bar ${barW.toFixed(0)}px of ${CONTAINER[320]}px)`);
  // Even the slowest channel's fill stays inside its track (no fixed pill x).
  const slow = renderAcquisitionRoiSvg({
    ...fixture,
    channels: [{ name: 'Slow Channel', totalAcquisitions: 5, paybackMonths: 6.5, blendedCac: 5000, netRoiPercent: 12.3, velocityStatus: 'Lagging Payback', color: '#3b82f6' }],
  });
  assert.ok(slow.includes('6.5m · +12.3% ROI'), 'slow channel value renders');
  assert.ok(slow.includes('LAGGING'), 'slow channel pill renders');
  assert.ok(!slow.includes('<svg'), 'slow channel has no SVG either');
});

test('name line fits on one line at 360px and wraps (never clips) at 320px', () => {
  for (const ch of fixture.channels) {
    const w = ch.name.length * ADV.bold13 + ` (${ch.totalAcquisitions} subs)`.length * ADV.reg11;
    assert.ok(w <= CONTAINER[360], `"${ch.name}" fits one line at 360px (${w.toFixed(0)}px of ${CONTAINER[360]}px)`);
  }
});

test('footer totals render as a wrapping HTML row with the same values', () => {
  assert.ok(html.includes('acquisition-roi-footer'), 'footer is HTML');
  const cells = html.match(/class="acquisition-roi-footer-cell"/g) || [];
  assert.equal(cells.length, 3, 'three footer cells');
  assert.ok(html.indexOf('Total CAC:') < html.indexOf('Realized Rev:') && html.indexOf('Realized Rev:') < html.indexOf('Avg Payback:'), 'same cell order as before');
  assert.ok(html.includes('PKR 330,600'), 'Total CAC value unchanged');
  assert.ok(html.includes('PKR 576,900'), 'Realized Rev value unchanged');
  assert.ok(html.includes('2.5 mo'), 'Avg Payback value unchanged');
  assert.match(cssSrc, /\.acquisition-roi-footer\s*\{[^}]*flex-wrap:\s*wrap;/);
  assert.match(cssSrc, /\.acquisition-roi-footer-cell\s*\{[^}]*white-space:\s*nowrap;/);
});

test('channel colours are tokens where exact, kept hex where not', () => {
  const block = djSrc.match(/export const ACQUISITION_CHANNELS = \[[\s\S]*?\n\];/)[0];
  assert.ok(!block.includes('#0e5b4d'), 'walkin #0e5b4d is tokenized');
  assert.ok(!block.includes('#10b981'), 'referral #10b981 is tokenized');
  assert.ok(!block.includes('#f59e0b'), 'marketing #f59e0b is tokenized');
  assert.ok(block.includes("color: 'var(--color-brand-600)'"), 'walkin uses --color-brand-600');
  assert.ok(block.includes("color: 'var(--color-emerald)'"), 'referral uses --color-emerald');
  assert.ok(block.includes("color: 'var(--td-risk-moderate)'"), 'marketing uses --td-risk-moderate');
  // Kept hex (no exact token) with a why-comment: technician #3b82f6
  // (closest --color-info-strong #2563eb is a darker blue), digital #8b5cf6,
  // partnership #06b6d4.
  assert.ok(block.includes("color: '#3b82f6'"), 'technician #3b82f6 kept as hex');
  assert.ok(block.includes("color: '#8b5cf6'"), 'digital #8b5cf6 kept as hex');
  assert.ok(block.includes("color: '#06b6d4'"), 'partnership #06b6d4 kept as hex');
  assert.match(djSrc, /exact token, so they stay as hex/);
});

test('velocity pill fills and texts are tokenized', () => {
  assert.ok(!/rgba\(16,\s*185,\s*129,\s*0\.15\)|rgba\(59,\s*130,\s*246,\s*0\.15\)|rgba\(245,\s*158,\s*11,\s*0\.15\)/.test(dcSrc.slice(dcSrc.indexOf('export function renderAcquisitionRoiSvg'), dcSrc.indexOf('export function renderBandwidthShapingSvg'))), 'no rgba pill fills in the renderer');
  assert.match(cssSrc, /\.acquisition-roi-pill--rapid\s*\{[^}]*color-mix\(in srgb, var\(--color-emerald\) 15%, transparent\)[^}]*color:\s*var\(--color-emerald-dark\);/);
  assert.match(cssSrc, /\.acquisition-roi-pill--standard\s*\{[^}]*color-mix\(in srgb, #3b82f6 15%, transparent\)[^}]*color:\s*var\(--color-info-strong\);/);
  assert.match(cssSrc, /\.acquisition-roi-pill--lagging\s*\{[^}]*color-mix\(in srgb, var\(--td-risk-moderate\) 15%, transparent\)[^}]*color:\s*var\(--td-risk-moderate-deep\);/);
  assert.ok(html.includes('acquisition-roi-pill--rapid'), 'RAPID pill class renders');
  assert.ok(html.includes('acquisition-roi-pill--standard'), 'STANDARD pill class renders');
});

test('footer colours are tokenized except the kept red', () => {
  const fn = dcSrc.slice(dcSrc.indexOf('export function renderAcquisitionRoiSvg'), dcSrc.indexOf('export function renderBandwidthShapingSvg'));
  assert.ok(!fn.includes('#047857'), 'footer Realized Rev #047857 is tokenized');
  assert.ok(!fn.includes('#dc2626'), 'footer Total CAC #dc2626 is not a literal in the renderer');
  assert.match(cssSrc, /\.acquisition-roi-footer-rev\s*\{[^}]*color:\s*var\(--color-emerald-dark\);/);
  // Kept hex with a why-comment: #dc2626 must not shift to --color-danger
  // #b42318 (the modal's ROI red uses the same value).
  assert.match(cssSrc, /\.acquisition-roi-footer-cac\s*\{[^}]*color:\s*#dc2626;/);
  assert.match(cssSrc, /must not become different shades/);
  // Bar track: rgba(0, 0, 0, 0.05) -> color-mix ink 5% (near-exact, disclosed).
  assert.ok(!/fill="rgba\(0,\s*0,\s*0,\s*0\.05\)"/.test(fn), 'no rgba bar track in the renderer');
  assert.match(cssSrc, /\.acquisition-roi-bar\s*\{[^}]*background:\s*color-mix\(in srgb, var\(--ink, #182e2a\) 5%, transparent\);/);
});

test('numbers are unchanged vs the fixture', () => {
  for (const ch of fixture.channels) {
    assert.ok(html.includes(`${ch.paybackMonths}m · ${ch.netRoiPercent > 0 ? '+' : ''}${ch.netRoiPercent}% ROI`), `value for "${ch.name}" unchanged`);
    assert.ok(html.includes(`(${ch.totalAcquisitions} subs)`), `subs for "${ch.name}" unchanged`);
  }
  // Bar widths keep the same payback/maxMonths ratio as the old SVG fill.
  assert.match(html, /width:25\.0%;background:var\(--color-emerald\);/);
  assert.match(html, /width:33\.3%;background:var\(--color-brand-600\);/);
  assert.match(html, /width:53\.3%;background:var\(--td-risk-moderate\);/);
  assert.match(html, /width:46\.7%;background:#3b82f6;/);
});

test('no role="img" over text content; the call site drops it from the container', () => {
  assert.ok(!html.includes('role="img"'), 'output carries no role="img"');
  assert.ok(!html.includes('aria-label="Acquisition'), 'output carries no chart aria-label');
  assert.match(dcSrc, /acqEl\.removeAttribute\('role'\);/);
  assert.match(dcSrc, /acqEl\.removeAttribute\('aria-label'\);/);
});

test('empty state renders as HTML with the same wording', () => {
  const empty = renderAcquisitionRoiSvg({ totalPortfolioAcquisitions: 0, channels: [] });
  assert.ok(!empty.includes('<svg'), 'empty state has no SVG');
  assert.ok(empty.includes('No subscriber acquisition data available'), 'empty title unchanged');
  assert.ok(empty.includes('Add customers to evaluate acquisition channel payback velocity, CAC unit economics, and marketing ROI'), 'empty subtitle unchanged');
});

test('panel height is measured: HTML rows are no taller than the old 222px SVG', () => {
  // Row geometry from dashboard.css: name 13px x 1.3 = 17px + 4px gap
  // + bar 16px = 37px per row; rows gap 8px; footer margin 4px + ~14px line.
  const rowH = 17 + 4 + 16;
  const rowsH = 4 * rowH + 3 * 8;
  const footerH = 4 + 14;
  const total = rowsH + 8 + footerH;
  assert.ok(total <= 222, `panel ~${total}px at 360px/320px (old SVG 222px) — no growth`);
});
