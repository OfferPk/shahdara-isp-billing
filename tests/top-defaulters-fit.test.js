// Top Defaulters Modal Polish (2026-11-13) — structural fit pins.
//
// One-screen compact modal: a single scroll container (the dialog owns
// the scroll — the nested 380px list box is gone), the Actions drawer
// collapsed by default as a slim 44px bottom bar, a compact header, a
// 2×2 KPI grid, short labels, a risk-coloured chart with a 1-line
// legend, normalized mohalla names, and the redundant segment chip
// deleted (D-B). The rendered-label pins live in top-defaulters.test.js
// (:686 card markup, :244 chart); this file pins the structure the
// rendered tests do not reach.
//
// Harness measurements (Chromium, 360×640) — NOT RUN in this
// environment: the sandbox Chromium SIGTRAPs intermittently, so no
// number is recorded here; the parent verifies on a phone after deploy:
//   - dialog scrollHeight vs viewport (single scroll container)
//   - Row 1 / Row 2 button labels fully visible, no ellipsis
//   - KPI cards 2×2, subtitle on one line, chart legend inside viewBox
// Never report a harness number that was not measured.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createInitialState, addCustomer, saveBillMonth } from '../core.js';
import { calculateTopDefaulters } from '../dashboard-top-defaulters.js';

const html = fs.readFileSync(path.resolve('./index.html'), 'utf-8');
const css = fs.readFileSync(path.resolve('./styles.css'), 'utf-8');
const tokens = fs.readFileSync(path.resolve('./tokens.css'), 'utf-8');
const lang = fs.readFileSync(path.resolve('./nav-language.js'), 'utf-8');
const controller = fs.readFileSync(path.resolve('./dashboard-top-defaulters.js'), 'utf-8');

function modalSlice() {
  const start = html.indexOf('id="topDefaultersModal"');
  const end = html.indexOf('<dialog', start + 1);
  return html.slice(start, end === -1 ? undefined : end);
}

test('Fit - Actions drawer starts collapsed as the slim 44px bottom bar', () => {
  const modal = modalSlice();
  const details = modal.match(/<details class="defaulters-actions-details"[^>]*>/);
  assert.ok(details, 'Actions <details> must exist in the modal');
  assert.ok(!/\bopen\b/.test(details[0]), 'Actions drawer must start collapsed (no open attribute)');
  assert.ok(css.includes('min-height: 44px'), 'collapsed Actions bar must be the slim 44px bar');
});

test('Fit - risk tokens exist in tokens.css with the spec values', () => {
  assert.ok(tokens.includes('--td-risk-critical: #EF4444;'), 'critical token must be #EF4444');
  assert.ok(tokens.includes('--td-risk-high: #F97316;'), 'high token must be #F97316');
  assert.ok(tokens.includes('--td-risk-moderate: #F59E0B;'), 'moderate token must be #F59E0B');
  assert.ok(tokens.includes('--td-risk-moderate-deep: #D97706;'), 'moderate-deep token must be #D97706');
});

test('Fit - cct_contacted exists in both language dicts', () => {
  assert.ok(lang.includes("cct_contacted: 'Contacted'"), 'EN cct_contacted must exist');
  assert.ok(lang.includes("cct_contacted: 'رابطہ ہو گیا'"), 'UR cct_contacted must exist');
});

test('Fit - segment chip is deleted from the card render (D-B)', () => {
  assert.ok(!controller.includes('defaulterSegmentChipHtml'), 'card must not call defaulterSegmentChipHtml');
  assert.ok(!controller.includes('segmentBadge'), 'no segment badge may survive in the controller');
});

test('Fit - mohalla names are normalized once in the row builder', () => {
  const refDate = new Date('2026-04-01T12:00:00Z');
  let state = createInitialState([]);
  const mk = (name, mohalla, phone) => {
    state = addCustomer(state, name, refDate, { phone, mohalla });
    const c = state.customers[state.customers.length - 1];
    state = saveBillMonth(state, c.id, { month: '2026-01', dueAmount: 2000, status: 'pending' }, refDate);
    state = saveBillMonth(state, c.id, { month: '2026-02', dueAmount: 2000, status: 'pending' }, refDate);
    state = saveBillMonth(state, c.id, { month: '2026-03', dueAmount: 2500, status: 'pending' }, refDate);
  };
  // Pattern-fake phones from the same family the existing TD fixture uses.
  mk('Muhammad Tariq', 'bani', '03001234567');
  mk('Abdul Rehman', 'Mohalla Bani', '03001234568');
  mk('Ahmed Raza', 'Main Bazaar', '03001234569');

  const data = calculateTopDefaulters(state);
  const byName = new Map(data.accounts.map((a) => [a.name, a]));
  // 'bani' and 'Mohalla Bani' fold to the same fixed-list label; a
  // mohalla outside the fixed list keeps its own label.
  assert.equal(byName.get('Muhammad Tariq').mohalla, 'Banii', 'lowercase variant normalizes');
  assert.equal(byName.get('Abdul Rehman').mohalla, 'Banii', 'Mohalla-prefixed variant normalizes');
  assert.equal(byName.get('Ahmed Raza').mohalla, 'Main Bazaar', 'unlisted mohalla keeps its label');
});
