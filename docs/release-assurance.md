# Release assurance (Plan Z)

How a version of Shahdara ISP Billing is declared, pinned, and called
ready — without ever shipping stale cached code to an offline-first PWA.

## The version, defined once

The shipped version is `1.11.0`, defined in exactly two places that a
test holds equal:

1. `package.json` — `"version"`.
2. `release-assurance.js` — `APP_VERSION`.

Every `?v=` cache-busting pin in the runtime files (`index.html`,
`app.js`, `nav-pwa.js`, `nav-quick-collect.js`, `router-credentials.js`,
`screen-router.js`, `storage-safety.js`) must equal `APP_VERSION`.
`tests/plan-z-release-assurance.test.js` reads those files and fails on
any stale pin. Plan Z itself fixed the last four drifted pins
(`tokens.css`, `components.css` and `thermal-printer.js` in two files,
all still saying `1.0.0` while everything else said `1.11.0`).

Two things are deliberately NOT version sources:

- The manifest (`manifest.webmanifest`) has no version field — the
  manifest spec defines none, so inventing one would be a second,
  meaningless source of truth. The gate checks only that it carries no
  conflicting pin or version.
- The service-worker cache name (`shahdara-isp-billing-v37` in `sw.js`)
  is a cache generation, not the app version; the build appends a
  content hash to it in `dist/sw.js`. Never equate the two.

## How to bump the version

Do all three together, in one change, or the consistency test fails
and the bump is visibly partial:

1. `package.json` — `"version"`.
2. `release-assurance.js` — `APP_VERSION`.
3. Every `?v=` pin in the runtime files listed above.

Do not bump the version as part of a feature PR: a version bump is its
own change, reviewed against this checklist.

## The pre-release gate

`release-assurance.js` (`RELEASE_CHECKLIST`, `evaluateReleaseGate`)
defines the gate. A release is READY only when every item passes:

| Item | Evidence required |
| --- | --- |
| Version consistency | package.json = APP_VERSION = every pin |
| Unit gate | `node scripts/test-gate.mjs unit` reports 0 failures |
| Build gate | `node scripts/test-gate.mjs build` succeeds, no budget loosened |
| E2e gate | Playwright e2e passed in CI, or honestly recorded as not-run |
| Changelog entry | Non-blank entry naming the version and its changes |
| Backup-compat note | Non-blank note: do backups from the previous version restore cleanly? |
| Plans A–Y | Every letter A–Y in the completed list |

E2e honesty rule: `not-run` is a blocker, never a pass. A skipped gate
is a skip, not a pass — the same rule as `scripts/test-gate.mjs`
(exit 2 means "could not run", never "passed"). A release marked READY
with e2e unrun would be a false claim, so the gate forbids it.

Backup-compat rule: nothing about a release is ready until someone has
stated, in writing, whether a backup taken under the previous version
restores under this one. Plan Z changes no backup format, so the note
for 1.11.0 is: format unchanged across Plans A–Z; restores behave as
before. A future format change must update this note, not assume it.

## Plans A–Y completion, reported against this gate

| Plan | PR | Plan | PR |
| --- | --- | --- | --- |
| A design-system foundations | #690 | N payment completion | #703 |
| B commercial app shell | #692 | O collections/follow-up | #704 |
| C accessibility foundations | #693 | P billing clarity | #705 |
| D mobile ≤480px | #694 | Q receipts/branding | #706 |
| E dark-mode completion | #695 | R owner reporting pack | #707 |
| F runtime performance | #696 | S field workflows | #708 |
| G offline reliability | #697 | T area operations | #709 |
| H security audit | #698 | U lifecycle journey | #710 |
| I testing infrastructure | #691 | V wallet display | #711 |
| J data safety | #699 | W help handbook | #712 |
| K payment integrity | #700 | X first-run presentation | #713 |
| L customer findability | #701 | Y scale / retention | #714 |
| M data quality | #702 | | |

Plan Z is the gate itself, not a feature: it adds no product behaviour,
no calculation change, and no version bump. The version it guards is
the version that was already shipping.
