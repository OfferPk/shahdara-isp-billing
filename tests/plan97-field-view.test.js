import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  FIELD_VIEW_CLASS,
  FIELD_VIEW_OUTCOMES,
  FIELD_VIEW_PARTIAL_BUTTON,
  fieldViewClassFor,
  fieldViewOutcomeButton,
  fieldViewRouteOutcomeButtons,
} from '../field-view.js';
import { VISIT_OUTCOMES } from '../visit-outcomes.js';

const here = dirname(fileURLToPath(import.meta.url));
const read = (name) => readFileSync(join(here, '..', name), 'utf8');

const URDU = /[\u0600-\u06FF]/;

test('Plan 97: outcome catalogue matches Plan 2 exactly, in Plan 2 order', () => {
  assert.deepEqual(
    FIELD_VIEW_OUTCOMES.map((entry) => entry.outcome),
    VISIT_OUTCOMES,
  );
  assert.equal(FIELD_VIEW_OUTCOMES.length, 6);
});

test('Plan 97: every outcome has an icon, a short Urdu-script label, and an English label', () => {
  for (const entry of FIELD_VIEW_OUTCOMES) {
    assert.ok(entry.icon, `${entry.outcome} needs an icon`);
    assert.match(entry.urdu, URDU, `${entry.outcome} needs an Urdu-script label`);
    assert.ok(entry.urdu.length <= 12, `${entry.outcome} Urdu label must stay short`);
    assert.ok(entry.english && entry.english.length > 0);
  }
});

test('Plan 97: one outcome button carries icon, Urdu label, outcome, customer id, active state and aria-pressed', () => {
  const html = fieldViewOutcomeButton({
    outcome: 'not_home',
    customerId: 'C-76',
    activeOutcome: 'not_home',
  });
  assert.match(html, /🚪/);
  assert.match(html, /گھر پر نہیں/);
  assert.match(html, /data-set-outcome="not_home"/);
  assert.match(html, /data-customer-id="C-76"/);
  assert.match(html, /is-active/);
  assert.match(html, /aria-pressed="true"/);
});

test('Plan 97: unknown outcome renders nothing and ids are escaped', () => {
  assert.equal(fieldViewOutcomeButton({ outcome: 'bogus', customerId: 'C-1' }), '');
  const html = fieldViewOutcomeButton({
    outcome: 'paid',
    customerId: '"><script>alert(1)</script>',
  });
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&quot;&gt;&lt;script&gt;/);
});

test('Plan 97: route row is 7 buttons in order, with partial flagged as non-Plan-2', () => {
  const html = fieldViewRouteOutcomeButtons({ activeOutcome: 'paid', customerId: 'C-1' });
  const outcomes = [...html.matchAll(/data-set-outcome="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(outcomes, [
    'paid', 'partial', 'promised', 'not_home', 'refused', 'dispute', 'no_answer',
  ]);
  assert.ok(!VISIT_OUTCOMES.includes(FIELD_VIEW_PARTIAL_BUTTON.outcome));
  assert.equal(FIELD_VIEW_PARTIAL_BUTTON.urdu, 'جزوی');
  assert.match(html, /½/);
});

test('Plan 97: toggle class helper returns the sunlight class only when enabled', () => {
  assert.equal(FIELD_VIEW_CLASS, 'field-view-big');
  assert.equal(fieldViewClassFor(true), 'field-view-big');
  assert.equal(fieldViewClassFor(false), '');
});

test('Plan 97: field-view module is pure — no imports, no storage, no DOM', () => {
  const source = read('field-view.js');
  assert.doesNotMatch(source, /^import /m);
  assert.doesNotMatch(source, /localStorage|sessionStorage/);
  assert.doesNotMatch(source, /document\.|window\./);
  const frozen = [...FIELD_VIEW_OUTCOMES];
  fieldViewRouteOutcomeButtons({ customerId: 'C-1' });
  assert.deepEqual(FIELD_VIEW_OUTCOMES, frozen);
});

test('Plan 97: CSS gives large high-contrast figures and thumb-sized targets, tokens only', () => {
  const css = read('field-view.css');
  const due = css.match(/\.field-mode-due-line strong \{[^}]*font-size: (\d+)px[^}]*border: 2px solid var\(--ink\)/s);
  assert.ok(due && Number(due[1]) >= 28, 'sheet due figure must be >= 28px with an ink border');
  const listDue = css.match(/\.field-mode-customer-due \{[^}]*font-size: (\d+)px/s);
  assert.ok(listDue && Number(listDue[1]) >= 24, 'list due figure must be >= 24px');
  const action = css.match(/\.field-mode-action-btn \{[^}]*min-height: (\d+)px/s);
  assert.ok(action && Number(action[1]) >= 56, 'primary actions must be >= 56px tall');
  const outcome = css.match(/\.field-view-outcome-btn \{[^}]*min-height: (\d+)px/s);
  assert.ok(outcome && Number(outcome[1]) >= 48, 'outcome buttons must be >= 48px tall');
  assert.doesNotMatch(css, /#[0-9a-fA-F]{3,8}\b/);
});

test('Plan 97: wiring — stylesheet, toggle default, route-sheet import and row, new badges, old buttons gone', () => {
  const html = read('index.html');
  assert.match(html, /field-view\.css\?v=1\.11\.0/);
  assert.match(html, /id="fieldModeBigViewToggleBtn"/);
  assert.match(html, /fieldModeBigViewToggleBtn"[^>]*aria-pressed="true"/);
  const fieldMode = read('field-mode.js');
  assert.match(fieldMode, /fieldModeBigViewToggleBtn/);
  assert.match(fieldMode, /classList\.add\('field-view-big'\)/);
  assert.match(fieldMode, /classList\.toggle\('field-view-big'\)/);
  const routes = read('nav-collection-rounds.js');
  assert.match(routes, /import \{ fieldViewRouteOutcomeButtons \} from '\.\/field-view\.js'/);
  assert.match(routes, /fieldViewRouteOutcomeButtons\(\{ activeOutcome: outcome, customerId: stop\.id \}\)/);
  assert.match(routes, /outcome === 'dispute'/);
  assert.match(routes, /outcome === 'no_answer'/);
  assert.doesNotMatch(routes, /action-btn-xs outcome-btn/);
});
