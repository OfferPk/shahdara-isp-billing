// seed-roster.mjs — synthetic roster seeding for e2e specs.
//
// PRIVACY: PR #478 (2026-10-29) emptied the shipped customer roster
// (core INITIAL_NAMES + default-customers.js are empty frozen arrays)
// because this repository is public and must not carry real customer
// names. Specs written against the old built-in seed — 74 customers
// with ids seed-001..seed-074 — therefore boot to an empty app and
// fail (or silently assert nothing). This helper restores the same
// starting point with clearly-fake data only:
//
//   "Test Customer 01" .. "Test Customer 74"
//
// The state is built through the app's own createInitialState()
// factory, so record shapes match production exactly and the planted
// localStorage payload travels the app's real readState sanitize path
// on boot — the same path the old built-in seed travelled. Nothing in
// this file ships in the app bundle (tests/e2e is never built into
// dist), and the shipped app remains roster-free.
//
// Usage in a spec that depended on the built-in seed:
//
//   import { installSyntheticRoster } from './seed-roster.mjs';
//   test.beforeEach(async ({ page }) => {
//     await installSyntheticRoster(page);
//     await page.goto('/');
//     ...
//   });
//
// installSyntheticRoster must be called BEFORE the first navigation.
// It plants the roster only when the storage key is absent, so a
// spec's own localStorage.clear() + reload re-seeds, while state the
// app itself saved during a test is never overwritten on reload.

import { createInitialState, STORAGE_KEY } from '../../core.js';

export const SYNTHETIC_ROSTER_SIZE = 74;

export function syntheticRosterNames(count = SYNTHETIC_ROSTER_SIZE) {
  return Array.from({ length: count }, (_, i) => `Test Customer ${String(i + 1).padStart(2, '0')}`);
}

export function buildSyntheticRosterState(count = SYNTHETIC_ROSTER_SIZE) {
  return createInitialState(syntheticRosterNames(count));
}

export async function installSyntheticRoster(page, count = SYNTHETIC_ROSTER_SIZE) {
  const state = buildSyntheticRosterState(count);
  await page.addInitScript(({ key, state: seedState }) => {
    try {
      if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(seedState));
    } catch {
      // Storage unavailable (private mode etc.): the app boots empty,
      // exactly like a fresh device — the spec's assertions decide.
    }
  }, { key: STORAGE_KEY, state });
}
