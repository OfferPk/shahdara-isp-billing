// Plan Z — Enterprise release assurance: version single source of truth
// and the pre-release gate.
//
// PRESENTATION / PROCESS ONLY. This module never changes a bill, a
// payment, a customer, or any stored data, and it is not imported by
// app.js: it exists so a release can be checked, not so the app can
// behave differently.
//
// The version problem this plan fixes: releases were pinned by hand
// (`?v=1.11.0` repeated across index.html script tags and dozens of
// app.js imports, plus `./sw.js?v=1.11.0`), and a missed bump ships
// stale cached code to an offline-first PWA. Three pins had already
// drifted to `?v=1.0.0` (tokens.css, components.css, thermal-printer.js)
// while everything else said 1.11.0 — exactly the failure mode.
//
// Single source of truth, in two places that a test holds equal:
//   1. package.json "version" (the release's declared version), and
//   2. APP_VERSION below (the version the gate checks pins against).
// Every `?v=` pin in the runtime files must equal APP_VERSION.
// The bump procedure (docs/release-assurance.md): change package.json
// AND APP_VERSION AND every pin together; the consistency test fails
// otherwise, so a partial bump cannot slip through.
//
// What this module deliberately does NOT cover, and why:
//   - The manifest (manifest.webmanifest) carries no version: the
//     manifest spec has no version field, so inventing one would be a
//     second, meaningless source of truth. The gate checks only that
//     the manifest carries no conflicting pin or version.
//   - The service-worker cache name (`shahdara-isp-billing-v37` in
//     sw.js) is a cache generation, not the app version: the build
//     appends a content hash to it in dist/sw.js. It is checked for
//     shape only, never equated with APP_VERSION.
//   - Playwright e2e status is never inferred: 'not-run' is a blocker
//     for a READY verdict, never a pass. A skipped gate is a skip,
//     not a pass (same rule as scripts/test-gate.mjs).

export const APP_VERSION = '1.11.0';

// Plans A–Y: the programme Plan Z reports against. Z itself is the
// gate, so it is not in its own completion list.
export const PLANS_A_TO_Y = [
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
  'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y',
];

// The release checklist. Every item is required: a release is not
// READY while any of them is unmet. `how` names the evidence that
// must exist for the item, so a verdict can be audited.
export const RELEASE_CHECKLIST = [
  { id: 'version-consistency', title: 'Version defined once, pinned everywhere', required: true, how: 'package.json version equals APP_VERSION and every ?v= pin in the runtime files equals APP_VERSION' },
  { id: 'unit-gate', title: 'Full unit gate passes', required: true, how: 'node scripts/test-gate.mjs unit reports 0 failures' },
  { id: 'build-gate', title: 'Production build gate passes', required: true, how: 'node scripts/test-gate.mjs build succeeds with no budget loosened' },
  { id: 'e2e-gate', title: 'Playwright e2e status recorded', required: true, how: 'e2e run in CI with a pass, or honestly recorded as not-run (which blocks READY)' },
  { id: 'changelog-entry', title: 'Changelog entry for the version', required: true, how: 'a non-blank changelog entry naming the version and its changes' },
  { id: 'backup-compat-note', title: 'Backup-compatibility note', required: true, how: 'a non-blank note stating whether saved backups from the previous version restore cleanly' },
  { id: 'plans-a-to-y', title: 'Plans A–Y complete', required: true, how: 'every letter A–Y present in the completed-plans list' },
];

// All `?v=<semver>` pins in a source string, in order. Bare `?v=`
// (as in nav-pwa.js comments) and non-version queries are ignored.
export function extractVersionPins(source) {
  if (typeof source !== 'string') return [];
  const pins = [];
  for (const match of source.matchAll(/\?v=(\d+\.\d+\.\d+)/g)) pins.push(match[1]);
  return pins;
}

// Check one release's version story. `files` is [{ name, source }].
// Returns the pins found, the stale ones (pin !== APP_VERSION, named
// with their file), and whether the whole story is consistent.
export function checkVersionConsistency({ packageVersion, appVersion, files }) {
  const list = Array.isArray(files) ? files : [];
  const stalePins = [];
  let totalPins = 0;
  for (const file of list) {
    for (const pin of extractVersionPins(file && file.source)) {
      totalPins += 1;
      if (pin !== appVersion) stalePins.push({ file: file.name, pin });
    }
  }
  const distinctPins = [...new Set(
    list.flatMap((file) => extractVersionPins(file && file.source)),
  )];
  return {
    expected: appVersion,
    packageVersion,
    appVersion,
    filesChecked: list.length,
    totalPins,
    distinctPins,
    stalePins,
    consistent: packageVersion === appVersion
      && appVersion !== undefined && appVersion !== ''
      && stalePins.length === 0,
  };
}

// Which of Plans A–Y are done, and which are still missing. Unknown
// letters are ignored; duplicates are collapsed; order follows A–Y.
export function plansCompletionReport(completed) {
  const done = new Set(Array.isArray(completed) ? completed : []);
  const completedPlans = PLANS_A_TO_Y.filter((letter) => done.has(letter));
  return {
    completed: completedPlans,
    missing: PLANS_A_TO_Y.filter((letter) => !done.has(letter)),
    complete: completedPlans.length === PLANS_A_TO_Y.length,
  };
}

function gateStatus(value) {
  if (value === 'pass') return 'pass';
  if (value === 'not-run') return 'not-run';
  return 'fail';
}

function blank(value) {
  return typeof value !== 'string' || value.trim() === '';
}

// Evaluate the whole pre-release gate. Nothing here runs a test, a
// build, or e2e: the caller supplies the recorded statuses, and this
// function only judges them — so a verdict can never claim a gate
// passed that was never run. `e2eGate: 'not-run'` blocks READY.
export function evaluateReleaseGate(input) {
  const data = input || {};
  const plans = plansCompletionReport(data.plansCompleted);
  const checks = [
    { id: 'version-consistency', status: data.versionConsistent ? 'pass' : 'fail' },
    { id: 'unit-gate', status: gateStatus(data.unitGate) },
    { id: 'build-gate', status: gateStatus(data.buildGate) },
    { id: 'e2e-gate', status: gateStatus(data.e2eGate) },
    { id: 'changelog-entry', status: blank(data.changelogEntry) ? 'fail' : 'pass' },
    { id: 'backup-compat-note', status: blank(data.backupCompatNote) ? 'fail' : 'pass' },
    { id: 'plans-a-to-y', status: plans.complete ? 'pass' : 'fail' },
  ];
  const blockers = checks.filter((check) => check.status !== 'pass').map((check) => check.id);
  return {
    ready: blockers.length === 0,
    blockers,
    checks,
    missingPlans: plans.missing,
  };
}

// One auditable text report for a gate verdict.
export function formatReleaseGateReport(gate) {
  const verdict = gate && gate.ready ? 'READY' : 'NOT READY';
  const lines = [`Release gate: ${verdict}`];
  for (const check of (gate && gate.checks) || []) {
    lines.push(`${String(check.status).toUpperCase()}: ${check.id}`);
  }
  if (gate && gate.blockers && gate.blockers.length) {
    lines.push(`Blockers: ${gate.blockers.join(', ')}`);
  }
  if (gate && gate.missingPlans && gate.missingPlans.length) {
    lines.push(`Missing plans: ${gate.missingPlans.join(', ')}`);
  }
  return lines.join('\n');
}
