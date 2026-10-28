// Regression test for the 2026-10-28 "pauseSummary is not defined" bug: the
// profile info groups (renderCustomerProfileView) read pauseSummary.detail
// for the "Vacation hold" line, but the only pauseSummary const lived in
// renderDetail (for the header badge) — a different function scope, so the
// reference was unbound. Every renderDetail call threw, which surfaced as a
// red error banner on every payment save (the save callback re-renders the
// profile) — after the payment had already been persisted, so retrying Save
// could record the payment twice. The fix computes the summary inside
// renderCustomerProfileView itself; this test pins definition-before-use.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(fileURLToPath(new URL('../package.json', import.meta.url)));
const appJs = readFileSync(path.join(root, 'app.js'), 'utf8');

test('pauseSummary is defined inside renderCustomerProfileView before its use', () => {
  const fnStart = appJs.indexOf('function renderCustomerProfileView(customer)');
  assert.ok(fnStart >= 0, 'renderCustomerProfileView exists');
  const useAt = appJs.indexOf('const profileInfoGroupsHtml =', fnStart);
  assert.ok(useAt > fnStart, 'profile info groups are built inside renderCustomerProfileView');
  const defAt = appJs.indexOf('const pauseSummary = pauseBillingSummary(customer);', fnStart);
  assert.ok(defAt >= 0, 'renderCustomerProfileView defines pauseSummary');
  assert.ok(defAt < useAt, 'pauseSummary is defined before the info groups use it');
});

test('pauseSummary is defined exactly twice (profile view + renderDetail badge)', () => {
  const defs = appJs.match(/const pauseSummary = pauseBillingSummary\(customer\);/g) || [];
  assert.equal(defs.length, 2, `expected 2 pauseSummary definitions, found ${defs.length}`);
});

test('app.js imports pauseBillingSummary', () => {
  assert.ok(appJs.includes('pauseBillingSummary'), 'app.js imports pauseBillingSummary');
});
