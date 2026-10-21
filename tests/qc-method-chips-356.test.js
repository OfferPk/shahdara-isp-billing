// Issue #356 (found in the Payments deep test): the Quick Collect "Bank"
// chip carried data-method="Bank", which is not one of core
// PAYMENT_METHODS ("Bank Transfer" is). Tapping it set the hidden
// method select to a value with no matching option, emptying it — and
// the payment was then silently recorded as Cash. Every method chip
// must name a canonical PAYMENT_METHODS value.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PAYMENT_METHODS } from '../core.js';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('356: every Quick Collect method chip is a canonical PAYMENT_METHODS value', () => {
  const chips = [...html.matchAll(/class="quick-method-chip[^"]*" data-method="([^"]+)"/g)].map(m => m[1]);
  assert.ok(chips.length >= 5, `expected at least 5 method chips, found ${chips.length}`);
  for (const chip of chips) {
    assert.ok(PAYMENT_METHODS.includes(chip), `chip data-method "${chip}" is not in PAYMENT_METHODS (${PAYMENT_METHODS.join(', ')})`);
  }
  assert.ok(chips.includes('Bank Transfer'), 'the Bank chip must map to "Bank Transfer"');
});
