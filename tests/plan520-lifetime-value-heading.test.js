// Plan 520 — Lifetime-value heading joins the section order.
//
// The lifetime-value block is appended last inside the profile Info view
// and its heading was an <h3>, while the view heading is the only other
// <h3> and every profile section uses <h4>. Plan 520 makes the
// lifetime-value heading an <h4> like every sibling section and leaves
// the block last (parent's call — moving it under the header strip would
// reshuffle the profile order and risk the Plan 514 freshness-group and
// Plan 512 counter placements). No figure changes, no dedup: the block
// still shows the same tenure/package figures the header strip and the
// Service Tenure section also show — that duplication is noted in the
// PR body, not removed here. The visual is unchanged: the section's
// heading rule keeps its exact declarations, retargeted at h4.
//
// Design-citation note: the design cites profile-ui.js for the markup,
// but at the Plan 519 head customerLifetimeValueMarkup lives in app.js
// (app.js:5972) and is appended at app.js:6842; the cited app.js:6743
// had shifted. Content verified, not the line numbers.
//
// Boundary: the Billing tab's receipt-summary heading (app.js:3413) is
// a different panel's <h3> (it renders into #customerReceiptSummary,
// not #customerProfileView) — out of scope, untouched.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const appSrc = readFileSync(join(dir, '..', 'app.js'), 'utf8');
const stylesSrc = readFileSync(join(dir, '..', 'styles.css'), 'utf8');

function clvFunctionBody() {
  const start = appSrc.indexOf('function customerLifetimeValueMarkup(');
  assert.notEqual(start, -1, 'customerLifetimeValueMarkup must exist in app.js');
  const end = appSrc.indexOf('\n}\n', start);
  assert.notEqual(end, -1, 'customerLifetimeValueMarkup must end with a closing brace');
  return appSrc.slice(start, end);
}

test('Plan 520: lifetime-value heading is an h4 with the same id and text', () => {
  const body = clvFunctionBody();
  assert.ok(
    body.includes('<h4 id="customerLifetimeValueHeading">${t(\'prof_clv_heading\')}</h4>'),
    'CLV heading must be <h4 id="customerLifetimeValueHeading"> with the prof_clv_heading key',
  );
});

test('Plan 520: no h3 lifetime-value heading remains anywhere in app.js', () => {
  assert.ok(
    !appSrc.includes('<h3 id="customerLifetimeValueHeading">'),
    'the old <h3 id="customerLifetimeValueHeading"> must be gone',
  );
  const body = clvFunctionBody();
  assert.ok(!body.includes('<h3'), 'the CLV markup must contain no h3 at all');
});

test('Plan 520: the section still labels itself by the same heading id', () => {
  const body = clvFunctionBody();
  assert.ok(
    body.includes('<section class="customer-lifetime-value" aria-labelledby="customerLifetimeValueHeading">'),
    'the section must keep aria-labelledby="customerLifetimeValueHeading"',
  );
});

test('Plan 520: the view heading stays the h3, so levels run h3 (view) then h4 (sections)', () => {
  assert.ok(
    appSrc.includes('<div class="profile-view-heading"><h3>${t(\'prof_view_heading\')}</h3>'),
    'the profile view heading must stay the <h3>',
  );
  const body = clvFunctionBody();
  assert.ok(body.includes('<h4 id="customerLifetimeValueHeading">'), 'the CLV section heading must be an <h4>');
});

test('Plan 520: the block is still appended last (leave-it-last decision)', () => {
  assert.ok(
    appSrc.includes("$('#customerProfileView').insertAdjacentHTML('beforeend', customerLifetimeValueMarkup(lifetimeValue))"),
    'the CLV block must still be appended at the end of #customerProfileView',
  );
});

test('Plan 520: the heading keeps its exact look, retargeted at h4', () => {
  assert.ok(
    stylesSrc.includes('.customer-lifetime-value h4{margin:0 0 10px;color:#244a3e;font:700 15px Manrope,system-ui,sans-serif}'),
    'the CLV heading rule must keep its exact declarations on h4',
  );
  assert.ok(
    !stylesSrc.includes('.customer-lifetime-value h3{'),
    'no .customer-lifetime-value h3 rule must remain',
  );
});

test('Plan 520: the figures are untouched — no dedup, no figure change', () => {
  const body = clvFunctionBody();
  for (const key of [
    'prof_clv_revenue',
    'prof_clv_tenure',
    'prof_clv_avg_revenue',
    'prof_clv_delay',
    'prof_clv_future_value',
  ]) {
    assert.ok(body.includes(key), `the CLV markup must still render ${key}`);
  }
  assert.ok(
    body.includes('<dl class="customer-lifetime-grid">'),
    'the CLV figure grid must stay as it is',
  );
});

test('Plan 520: the lifetime engine and its call site are untouched', () => {
  assert.ok(
    appSrc.includes('const lifetimeValue = buildCustomerLifetimeValue(state, customer, new Date());'),
    'the lifetime-value computation call must stay as it is',
  );
});
