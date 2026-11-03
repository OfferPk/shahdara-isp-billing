// Plan I — Testing infrastructure and quality gates (Plan A-Z programme).
//
// One runnable gate for the whole suite. Usage (from the repo root):
//
//   node scripts/test-gate.mjs unit    # full unit suite, exact counts
//   node scripts/test-gate.mjs build   # production build (needs esbuild)
//   node scripts/test-gate.mjs e2e     # Playwright suite (needs browsers)
//   node scripts/test-gate.mjs all     # unit, then build, then e2e
//
// Exit codes are the contract, and they are deliberately three-valued:
//   0  the gate passed (every count is real, nothing was skipped)
//   1  the gate ran and failed (a test, the build, or e2e failed)
//   2  the gate could NOT run here (a required dependency is missing:
//      esbuild for build, @playwright/test or a Chromium browser for
//      e2e). Exit 2 is a SKIP, never a pass: a skipped gate must never
//      be reported as passed, and CI must treat it as a failure.
//      The bare-VM fallback is documented in docs/testing.md: run the
//      unit gate, and leave build/e2e to CI.
//
// The unit gate runs exactly `node --test tests/*.test.js` and parses
// the runner's own summary lines (`ℹ pass N`, `ℹ fail N`,
// `ℹ tests N`), so the counts it prints are the runner's counts, not
// a second count of its own. classifyFailures() only LABELS failures:
// a failure in one of the known build-dependent test files (the four
// files that run the real esbuild build) is reported as a known
// build gap, but the gate still exits 1. Labelling never waives a
// failure and no build budget is loosened anywhere in this plan.
//
// This file is tooling only: it is never imported by app code and is
// not in build.mjs ENTRY_FILES.

import { spawnSync } from 'node:child_process';
import { readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

// The four unit tests that run the real esbuild build and therefore
// cannot pass in a bare checkout without node_modules. They are the
// ONLY files the gate ever labels as a known build gap; every other
// failing file is reported as an ordinary failure.
export const KNOWN_BUILD_GAP_FILES = [
  'build-output.test.js',
  'build-scanner-safety.test.js',
  'manifest-verifier.test.js',
  'perf-budget-219.test.js',
];

export function isKnownBuildGap(file) {
  return KNOWN_BUILD_GAP_FILES.includes(path.basename(file));
}

// Parse a `node --test` summary into { tests, pass, fail }.
// Lines look like `ℹ tests 5290`, `ℹ pass 5285`, `ℹ fail 5`.
// A missing line means the runner never printed a summary (for
// example it crashed before finishing); that is reported as nulls,
// never as zeros, so a crash cannot masquerade as a pass.
export function parseTestSummary(output) {
  const find = (label) => {
    const match = String(output).match(new RegExp(`^ℹ ${label} (\\d+)`, 'm'));
    return match ? Number(match[1]) : null;
  };
  return { tests: find('tests'), pass: find('pass'), fail: find('fail') };
}

// Label failing test files. Returns { knownBuildGap: [...], other: [...] }
// with repo-relative file names, in the order given.
export function classifyFailures(failingFiles) {
  const knownBuildGap = [];
  const other = [];
  for (const file of failingFiles) {
    (isKnownBuildGap(file) ? knownBuildGap : other).push(file);
  }
  return { knownBuildGap, other };
}

// Failing test files, from the runner's failure report. The default
// reporter prints, after the summary, a `✖ failing tests:` section
// with one `test at tests/<file>.test.js:<line>:<col>` line per
// failing test. Anything that does not match that shape is ignored,
// so an unparsable report yields an empty list rather than invented
// file names. Files are deduplicated in first-seen order.
export function failingTestFiles(output) {
  const files = [];
  for (const line of String(output).split('\n')) {
    const match = line.match(/test at (tests\/\S+\.test\.js):\d+:\d+/);
    if (match && !files.includes(match[1])) files.push(match[1]);
  }
  return files;
}

function unitFiles() {
  return readdirSync(path.join(ROOT, 'tests'))
    .filter((f) => f.endsWith('.test.js'))
    .sort()
    .map((f) => path.join('tests', f));
}

function runUnit() {
  const files = unitFiles();
  const result = spawnSync(process.execPath, ['--test', ...files], {
    cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
  });
  const output = `${result.stdout || ''}${result.stderr || ''}`;
  const summary = parseTestSummary(output);
  const failed = failingTestFiles(output);
  const classified = classifyFailures(failed);
  console.log(`UNIT ${summary.pass ?? '?'} pass / ${summary.fail ?? '?'} fail / ${summary.tests ?? '?'} tests (${files.length} files)`);
  if (failed.length) {
    console.log(`UNIT failing files: ${failed.join(', ')}`);
    if (classified.knownBuildGap.length) {
      console.log(`UNIT known build gap (esbuild missing, see docs/testing.md): ${classified.knownBuildGap.join(', ')}`);
    }
    if (classified.other.length) {
      console.log(`UNIT other failures: ${classified.other.join(', ')}`);
    }
  }
  if (summary.fail === null || summary.pass === null) {
    console.log('UNIT gate could not read the runner summary; treating the run as failed.');
    return 1;
  }
  return summary.fail === 0 ? 0 : 1;
}

function runBuild() {
  const result = spawnSync(process.execPath, ['build.mjs'], {
    cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
  });
  const output = `${result.stdout || ''}${result.stderr || ''}`;
  if (output.includes('esbuild is not installed')) {
    console.log('BUILD SKIPPED: esbuild is not installed (run npm ci). A skipped build gate is not a pass; see docs/testing.md.');
    return 2;
  }
  if (result.status !== 0) {
    console.log('BUILD failed:');
    console.log(output.slice(-4000));
    return 1;
  }
  console.log('BUILD passed.');
  return 0;
}

function runE2e() {
  if (!existsSync(path.join(ROOT, 'node_modules', '@playwright', 'test'))) {
    console.log('E2E SKIPPED: @playwright/test is not installed (run npm ci, then npx playwright install --with-deps chromium). A skipped e2e gate is not a pass; see docs/testing.md.');
    return 2;
  }
  const result = spawnSync('npm', ['run', 'test:e2e'], {
    cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, shell: true,
  });
  if (result.status !== 0) {
    console.log('E2E failed:');
    console.log(`${result.stdout || ''}${result.stderr || ''}`.slice(-4000));
    return 1;
  }
  console.log('E2E passed.');
  return 0;
}

export function gateModes() {
  return ['unit', 'build', 'e2e', 'all'];
}

function main(argv) {
  const mode = argv[2] || 'unit';
  if (!gateModes().includes(mode)) {
    console.error(`Unknown mode "${mode}". Use one of: ${gateModes().join(', ')}.`);
    return 1;
  }
  if (mode === 'all') {
    for (const step of ['unit', 'build', 'e2e']) {
      const code = step === 'unit' ? runUnit() : step === 'build' ? runBuild() : runE2e();
      if (code !== 0) return code;
    }
    console.log('ALL gates passed.');
    return 0;
  }
  if (mode === 'unit') return runUnit();
  if (mode === 'build') return runBuild();
  return runE2e();
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv);
}
