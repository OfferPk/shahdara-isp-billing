import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  APP_VERSION,
  PLANS_A_TO_Y,
  RELEASE_CHECKLIST,
  checkVersionConsistency,
  evaluateReleaseGate,
  extractVersionPins,
  formatReleaseGateReport,
  plansCompletionReport,
} from '../release-assurance.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const ALL_PASSING = {
  versionConsistent: true,
  unitGate: 'pass',
  buildGate: 'pass',
  e2eGate: 'pass',
  changelogEntry: '1.11.0 — release assurance',
  backupCompatNote: 'Backups from the previous version restore cleanly.',
  plansCompleted: [...PLANS_A_TO_Y],
};

// ---- APP_VERSION and PLANS_A_TO_Y ----

test('APP_VERSION is a semver string', () => {
  assert.match(APP_VERSION, /^\d+\.\d+\.\d+$/);
});

test('APP_VERSION carries the current shipped version, not a bump', () => {
  assert.equal(APP_VERSION, '1.11.0');
});

test('PLANS_A_TO_Y holds exactly 25 plans', () => {
  assert.equal(PLANS_A_TO_Y.length, 25);
});

test('PLANS_A_TO_Y runs A to Y in order', () => {
  assert.equal(PLANS_A_TO_Y[0], 'A');
  assert.equal(PLANS_A_TO_Y[24], 'Y');
  assert.deepEqual(PLANS_A_TO_Y, [...PLANS_A_TO_Y].sort());
});

test('PLANS_A_TO_Y excludes Z (Z is the gate itself)', () => {
  assert.ok(!PLANS_A_TO_Y.includes('Z'));
});

test('PLANS_A_TO_Y has no duplicate letters', () => {
  assert.equal(new Set(PLANS_A_TO_Y).size, PLANS_A_TO_Y.length);
});

// ---- extractVersionPins ----

test('extractVersionPins returns pins in order', () => {
  assert.deepEqual(
    extractVersionPins('<script src="./a.js?v=1.11.0"></script> import x from "./b.js?v=1.2.3";'),
    ['1.11.0', '1.2.3'],
  );
});

test('extractVersionPins ignores a bare ?v= with no version', () => {
  assert.deepEqual(extractVersionPins('the version is the ?v= in the URL'), []);
});

test('extractVersionPins ignores non-version queries', () => {
  assert.deepEqual(extractVersionPins('page?view=all&x=1'), []);
});

test('extractVersionPins returns [] for empty or non-string input', () => {
  assert.deepEqual(extractVersionPins(''), []);
  assert.deepEqual(extractVersionPins(null), []);
  assert.deepEqual(extractVersionPins(undefined), []);
});

// ---- checkVersionConsistency ----

test('checkVersionConsistency passes when package, code and pins agree', () => {
  const result = checkVersionConsistency({
    packageVersion: '1.11.0',
    appVersion: '1.11.0',
    files: [{ name: 'index.html', source: '<script src="./a.js?v=1.11.0">' }],
  });
  assert.equal(result.consistent, true);
  assert.deepEqual(result.stalePins, []);
  assert.equal(result.totalPins, 1);
});

test('checkVersionConsistency names the stale pin with its file', () => {
  const result = checkVersionConsistency({
    packageVersion: '1.11.0',
    appVersion: '1.11.0',
    files: [
      { name: 'index.html', source: '<script src="./a.js?v=1.11.0">' },
      { name: 'app.js', source: "import x from './t.js?v=1.0.0';" },
    ],
  });
  assert.equal(result.consistent, false);
  assert.deepEqual(result.stalePins, [{ file: 'app.js', pin: '1.0.0' }]);
});

test('checkVersionConsistency fails when package.json disagrees', () => {
  const result = checkVersionConsistency({
    packageVersion: '1.10.0',
    appVersion: '1.11.0',
    files: [],
  });
  assert.equal(result.consistent, false);
});

test('checkVersionConsistency fails when appVersion is blank', () => {
  const result = checkVersionConsistency({
    packageVersion: '1.11.0',
    appVersion: '',
    files: [],
  });
  assert.equal(result.consistent, false);
});

test('checkVersionConsistency passes with no files when package and code agree', () => {
  const result = checkVersionConsistency({
    packageVersion: '1.11.0',
    appVersion: '1.11.0',
    files: [],
  });
  assert.equal(result.consistent, true);
  assert.equal(result.totalPins, 0);
});

test('checkVersionConsistency reports distinct pins', () => {
  const result = checkVersionConsistency({
    packageVersion: '1.11.0',
    appVersion: '1.11.0',
    files: [{ name: 'a.js', source: '?v=1.11.0 ?v=1.0.0 ?v=1.11.0' }],
  });
  assert.deepEqual(result.distinctPins, ['1.11.0', '1.0.0']);
});

// ---- plansCompletionReport ----

test('plansCompletionReport is complete when all A–Y are present', () => {
  const report = plansCompletionReport([...PLANS_A_TO_Y]);
  assert.equal(report.complete, true);
  assert.deepEqual(report.missing, []);
});

test('plansCompletionReport lists exactly the missing plans', () => {
  const report = plansCompletionReport(['A', 'B']);
  assert.equal(report.complete, false);
  assert.equal(report.missing.length, 23);
  assert.ok(report.missing.includes('Y'));
  assert.ok(!report.missing.includes('A'));
});

test('plansCompletionReport collapses duplicates', () => {
  const report = plansCompletionReport(['A', 'A', 'B', 'B']);
  assert.deepEqual(report.completed, ['A', 'B']);
});

test('plansCompletionReport ignores unknown letters', () => {
  const report = plansCompletionReport(['Z', 'A']);
  assert.deepEqual(report.completed, ['A']);
  assert.ok(!report.completed.includes('Z'));
});

test('plansCompletionReport on empty input misses everything', () => {
  const report = plansCompletionReport([]);
  assert.equal(report.complete, false);
  assert.deepEqual(report.missing, PLANS_A_TO_Y);
});

// ---- evaluateReleaseGate ----

test('evaluateReleaseGate is READY when every check passes', () => {
  const gate = evaluateReleaseGate(ALL_PASSING);
  assert.equal(gate.ready, true);
  assert.deepEqual(gate.blockers, []);
  assert.ok(gate.checks.every((check) => check.status === 'pass'));
});

test('evaluateReleaseGate blocks on version inconsistency', () => {
  const gate = evaluateReleaseGate({ ...ALL_PASSING, versionConsistent: false });
  assert.equal(gate.ready, false);
  assert.deepEqual(gate.blockers, ['version-consistency']);
});

test('evaluateReleaseGate blocks on a failed unit gate', () => {
  const gate = evaluateReleaseGate({ ...ALL_PASSING, unitGate: 'fail' });
  assert.equal(gate.ready, false);
  assert.ok(gate.blockers.includes('unit-gate'));
});

test('evaluateReleaseGate blocks on a not-run unit gate', () => {
  const gate = evaluateReleaseGate({ ...ALL_PASSING, unitGate: 'not-run' });
  assert.equal(gate.ready, false);
  assert.ok(gate.checks.find((c) => c.id === 'unit-gate').status === 'not-run');
});

test('evaluateReleaseGate blocks on a failed build gate', () => {
  const gate = evaluateReleaseGate({ ...ALL_PASSING, buildGate: 'fail' });
  assert.equal(gate.ready, false);
  assert.ok(gate.blockers.includes('build-gate'));
});

test('evaluateReleaseGate blocks on a not-run e2e gate — not-run is never a pass', () => {
  const gate = evaluateReleaseGate({ ...ALL_PASSING, e2eGate: 'not-run' });
  assert.equal(gate.ready, false);
  assert.ok(gate.blockers.includes('e2e-gate'));
  assert.ok(gate.checks.find((c) => c.id === 'e2e-gate').status !== 'pass');
});

test('evaluateReleaseGate blocks on a failed e2e gate', () => {
  const gate = evaluateReleaseGate({ ...ALL_PASSING, e2eGate: 'fail' });
  assert.equal(gate.ready, false);
  assert.ok(gate.blockers.includes('e2e-gate'));
});

test('evaluateReleaseGate blocks on a missing changelog entry', () => {
  const gate = evaluateReleaseGate({ ...ALL_PASSING, changelogEntry: '' });
  assert.equal(gate.ready, false);
  assert.ok(gate.blockers.includes('changelog-entry'));
});

test('evaluateReleaseGate treats a whitespace-only changelog as missing', () => {
  const gate = evaluateReleaseGate({ ...ALL_PASSING, changelogEntry: '   ' });
  assert.equal(gate.ready, false);
  assert.ok(gate.blockers.includes('changelog-entry'));
});

test('evaluateReleaseGate treats a non-string changelog as missing', () => {
  const gate = evaluateReleaseGate({ ...ALL_PASSING, changelogEntry: null });
  assert.equal(gate.ready, false);
  assert.ok(gate.blockers.includes('changelog-entry'));
});

test('evaluateReleaseGate blocks on a missing backup-compat note', () => {
  const gate = evaluateReleaseGate({ ...ALL_PASSING, backupCompatNote: '' });
  assert.equal(gate.ready, false);
  assert.ok(gate.blockers.includes('backup-compat-note'));
});

test('evaluateReleaseGate blocks on a missing plan and names it', () => {
  const gate = evaluateReleaseGate({
    ...ALL_PASSING,
    plansCompleted: PLANS_A_TO_Y.filter((letter) => letter !== 'Y'),
  });
  assert.equal(gate.ready, false);
  assert.ok(gate.blockers.includes('plans-a-to-y'));
  assert.deepEqual(gate.missingPlans, ['Y']);
});

test('evaluateReleaseGate lists every blocker when several checks fail', () => {
  const gate = evaluateReleaseGate({
    ...ALL_PASSING,
    versionConsistent: false,
    e2eGate: 'not-run',
    changelogEntry: '',
  });
  assert.deepEqual(gate.blockers, ['version-consistency', 'e2e-gate', 'changelog-entry']);
});

test('evaluateReleaseGate treats unknown gate values as failures', () => {
  const gate = evaluateReleaseGate({ ...ALL_PASSING, unitGate: 'maybe' });
  assert.equal(gate.ready, false);
  assert.ok(gate.blockers.includes('unit-gate'));
});

// ---- formatReleaseGateReport ----

test('formatReleaseGateReport states READY with no blockers', () => {
  const report = formatReleaseGateReport(evaluateReleaseGate(ALL_PASSING));
  assert.ok(report.startsWith('Release gate: READY'));
  assert.ok(!report.includes('Blockers:'));
});

test('formatReleaseGateReport states NOT READY and lists blockers', () => {
  const report = formatReleaseGateReport(evaluateReleaseGate({ ...ALL_PASSING, e2eGate: 'not-run' }));
  assert.ok(report.startsWith('Release gate: NOT READY'));
  assert.ok(report.includes('NOT-RUN: e2e-gate'));
  assert.ok(report.includes('Blockers: e2e-gate'));
});

test('formatReleaseGateReport lists missing plans', () => {
  const report = formatReleaseGateReport(evaluateReleaseGate({
    ...ALL_PASSING,
    plansCompleted: ['A'],
  }));
  assert.ok(report.includes('Missing plans:'));
  assert.ok(report.includes('Y'));
});

// ---- RELEASE_CHECKLIST ----

test('RELEASE_CHECKLIST has one entry per gate item, all required, no duplicate ids', () => {
  assert.equal(RELEASE_CHECKLIST.length, 7);
  assert.ok(RELEASE_CHECKLIST.every((item) => item.required === true));
  assert.equal(new Set(RELEASE_CHECKLIST.map((item) => item.id)).size, 7);
});

test('RELEASE_CHECKLIST covers version, gates, changelog, backup-compat and plans', () => {
  assert.deepEqual(
    RELEASE_CHECKLIST.map((item) => item.id),
    ['version-consistency', 'unit-gate', 'build-gate', 'e2e-gate', 'changelog-entry', 'backup-compat-note', 'plans-a-to-y'],
  );
});

// ---- Real-repo consistency (the acceptance test) ----

const PIN_FILES = [
  'app.js',
  'index.html',
  'nav-pwa.js',
  'nav-quick-collect.js',
  'router-credentials.js',
  'screen-router.js',
  'storage-safety.js',
];

test('repo: package.json version equals APP_VERSION', async () => {
  const pkg = JSON.parse(await readFile(path.join(ROOT, 'package.json'), 'utf8'));
  assert.equal(pkg.version, APP_VERSION);
});

test('repo: every ?v= pin in the runtime files equals APP_VERSION', async () => {
  const pkg = JSON.parse(await readFile(path.join(ROOT, 'package.json'), 'utf8'));
  const files = [];
  for (const name of PIN_FILES) {
    files.push({ name, source: await readFile(path.join(ROOT, name), 'utf8') });
  }
  const result = checkVersionConsistency({
    packageVersion: pkg.version,
    appVersion: APP_VERSION,
    files,
  });
  assert.equal(result.consistent, true, `stale pins: ${JSON.stringify(result.stalePins)}`);
  assert.deepEqual(result.stalePins, []);
});

test('repo: the pin scan is real, not vacuous', async () => {
  let total = 0;
  for (const name of PIN_FILES) {
    total += extractVersionPins(await readFile(path.join(ROOT, name), 'utf8')).length;
  }
  assert.ok(total >= 50, `expected 50+ pins across the runtime files, found ${total}`);
});

test('repo: manifest carries no version pin and no conflicting version field', async () => {
  const manifestSource = await readFile(path.join(ROOT, 'manifest.webmanifest'), 'utf8');
  assert.deepEqual(extractVersionPins(manifestSource), []);
  const manifest = JSON.parse(manifestSource);
  assert.ok(manifest.version === undefined, 'manifest must not invent a version field');
});

test('repo: service-worker cache name is a cache generation, not the app version', async () => {
  const sw = await readFile(path.join(ROOT, 'sw.js'), 'utf8');
  const match = sw.match(/CACHE_NAME = '([^']+)'/);
  assert.ok(match, 'sw.js declares CACHE_NAME');
  assert.match(match[1], /^shahdara-isp-billing-v\d+$/);
  assert.ok(!match[1].includes(APP_VERSION), 'cache generation is not conflated with the app version');
});
