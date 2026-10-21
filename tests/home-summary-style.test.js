// Home summary cards matched to the Today's Summary (khulasa) card +
// animated gradient border line (user request, 2026-10-21).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../dashboard.css', import.meta.url), 'utf8');
const block = css.slice(css.indexOf('Home summary cards'));

test('summary cards share the khulasa card geometry (radius + shadow)', () => {
  assert.ok(block.includes('border-radius: 16px'), 'radius matches .home-today-card');
  assert.ok(block.includes('box-shadow: 0 4px 16px rgba(22, 52, 43, 0.06)'), 'light shadow matches .home-today-card');
  assert.ok(block.includes('[data-theme="dark"] .summary-card'), 'dark variant present');
  assert.ok(block.includes('box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25)'), 'dark shadow matches .home-today-card dark');
});

test('every summary card gets the animated gradient line (tokens only, no new hex)', () => {
  assert.ok(block.includes('.summary-card::before'), 'strip applied to all summary cards, not just three types');
  assert.ok(block.includes('linear-gradient(90deg'), 'gradient line');
  for (const token of ['--color-brand-500', '--color-info', '--color-paid', '--color-whatsapp', '--color-pending', '--color-overdue']) {
    assert.ok(block.includes(`var(${token})`), `gradient uses ${token}`);
  }
  assert.ok(block.includes('animation: summary-line-flow 7s linear infinite'), 'line keeps moving');
  assert.ok(block.includes('@keyframes summary-line-flow'), 'keyframes defined');
  const hexes = block.match(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g) || [];
  assert.deepEqual(hexes, [], `no hard-coded hex in the new block (found ${hexes}) — #230 ratchet`);
});

test('khulasa card wears the same line; reduced motion stops it', () => {
  assert.ok(block.includes('.home-today-card::before'), 'today card strip');
  assert.ok(block.includes('@media (prefers-reduced-motion: reduce)'), 'reduced-motion guard');
  assert.ok(/prefers-reduced-motion: reduce\)[\s\S]*?animation: none/.test(block), 'animation disabled for reduced motion');
});
