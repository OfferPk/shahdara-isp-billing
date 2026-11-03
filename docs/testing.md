# Testing infrastructure and quality gates (Plan I)

This document is the single place that defines how the suite is run,
what each gate needs, and what to do when a gate cannot run here.
It is the Plan I deliverable of the Plan A-Z programme: no product
behaviour changed to write it.

## One command for the full unit suite

From the repo root, run:

```sh
node scripts/test-gate.mjs unit
```

That runs exactly `node --test tests/*.test.js` and prints the
runner's own summary as one line, for example:

```text
UNIT 5285 pass / 5 fail / 5290 tests (335 files)
```

The counts are the `node:test` runner's counts, parsed from its
`ℹ tests / ℹ pass / ℹ fail` summary lines. The gate exits 0 only
when fail is 0. A run the gate cannot parse (the runner crashed
before printing a summary) exits 1, never 0.

The same command is available as an npm script:

```sh
npm run test:gate
```

The older commands still work unchanged: `npm test` runs
`node --test`, and `npm run test:e2e` runs the build plus Playwright.
They are not replaced; the gate is the documented, counted front
door to them.

## The three gates

| Gate | Command | Needs | Exit codes |
| --- | --- | --- | --- |
| Unit | `node scripts/test-gate.mjs unit` | Node.js only | 0 pass, 1 fail |
| Build | `node scripts/test-gate.mjs build` | `npm ci` (esbuild) | 0 pass, 1 fail, 2 skipped |
| E2E | `node scripts/test-gate.mjs e2e` | `npm ci`, Playwright browsers | 0 pass, 1 fail, 2 skipped |
| All | `node scripts/test-gate.mjs all` | All of the above | First non-zero gate wins |

Exit code 2 means SKIPPED, and a skipped gate is never a pass.
CI treats any non-zero exit as a failure. A human reading a
bare-VM report must say "build/e2e skipped", not "build/e2e
passed".

The CI definition lives in `.github/workflows/ci.yml`: the test
job runs the unit gate, the e2e job runs the e2e gate, and the
Playwright report is uploaded as an artifact. The build itself
runs in the test job via `npm run build`.

## Requirements and the bare-VM fallback

- Unit gate: Node.js 20 or newer, nothing else. It runs in a bare
  checkout with no `node_modules`.
- Build gate: esbuild, installed by `npm ci`. Without it the build
  itself fails with "esbuild is not installed (run npm ci /
  npm install)", and the gate reports SKIPPED (exit 2).
- E2E gate: `@playwright/test` plus a Chromium browser, installed
  by `npm ci` and then `npx playwright install --with-deps
  chromium`. The suite is `tests/e2e/*.spec.mjs` under
  `playwright.config.mjs` (mobile 390x844 and desktop 1280x800
  projects, served by `tests/e2e/static-server.mjs` on port 4173
  from `dist/` when a build exists, otherwise from the repo root).
  Without Playwright the gate reports SKIPPED (exit 2).

Fallback, when browsers are absent (the bare-VM case): run the
unit gate and report its exact counts, then report build and e2e
as SKIPPED with the reason above, and leave both to CI. Do not
run a subset and call it the suite, and do not loosen any build
budget to make a bare checkout pass.

## Known build-gap failures (reporting only)

Four unit tests run the real esbuild build, so they fail in a bare
checkout with "esbuild is not installed" and pass after `npm ci`:

- `tests/build-output.test.js`
- `tests/build-scanner-safety.test.js`
- `tests/manifest-verifier.test.js`
- `tests/perf-budget-219.test.js`

The gate labels failures in those files as a known build gap in
its output, but it still exits 1. Labelling is not waiving: a PR
whose only failures are those four is still not green until CI
runs the build, and a PR with any other failure is an ordinary
failure regardless of how many build-gap files also fail.

The build path the tests exercise is `build.mjs` (graph walk from
`index.html`, esbuild bundling, single CSS bundle, service worker
precache), verified independently of the build by
`tests/qa-manifest-check.js` (existence, syntax, and bundle
reachability of the runtime graph). That checker is not a
substitute for the build: it proves the graph, not the bundle.

## Shared fixtures for new tests

New tests should build their data with `tests/test-fixtures.js`
instead of copying setup literals:

- `fixtureCustomer(overrides)` — one synthetic customer record.
- `fixtureBill(overrides)` — one synthetic bill with payments.
- `fixturePayment(overrides)` — one synthetic payment.
- `fixtureState(customers, overrides)` — a full ledger state.
- `inMemoryStorage(seed)` — a Map-backed getItem/setItem store,
  the helper that used to be copy-pasted into storage tests.
- `cloneFixture(value)` — a deep copy of a fixture value.

Every builder returns a fresh object per call. All fixture names,
phones and areas are synthetic; no real customer record is used,
and fixtures are never written to the app's real storage.

Existing tests were deliberately not migrated to these fixtures
in Plan I: moving hundreds of pinned assertions would churn the
suite for no gate value. The fixtures are for new tests, starting
with the Plan I harness tests themselves.

## Per-plan test-count report format (Plans J-Z)

Every plan PR body must include this block, with real numbers
from its own gate run. Never copy the estimate from the plan
file into this block, and never report a skipped gate as passed.

```text
Plan <letter> report:
- New tests added: <exact count> in <new test file(s)>
- Focused tests: <pass> pass / <fail> fail
- Relevant subset: <pass> pass / <fail> fail
- Full unit suite: <pass> pass / <fail> fail / <total> tests (<file count> files)
- Build gate: passed | failed | skipped (<reason>)
- E2E gate: passed | failed | skipped (<reason>)
```

Plan I report (filled in from its own run on 2026-11-03, bare VM
without node_modules; see the PR body for the verified numbers):

```text
Plan I report:
- New tests added: 80 in tests/plan-i-test-gates.test.js
- Focused tests: 80 pass / 0 fail
- Relevant subset: 131 pass / 0 fail (Plan I + Plan A token + design-tokens-230)
- Full unit suite: 5365 pass / 5 fail / 5370 tests (335 files)
- Build gate: skipped (esbuild is not installed in the bare VM)
- E2E gate: skipped (Playwright browsers are not installed in the bare VM)
```

The 5 full-suite failures are all in the four known build-gap
files (build-output, build-scanner-safety, manifest-verifier,
perf-budget-219), each failing with "esbuild is not installed".
No other file failed.
