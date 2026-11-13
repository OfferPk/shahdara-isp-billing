# Quick Collect CSS Layout Tightening & Mohalla Dropdown Sort

Up from 18,696/0.

## What this does

**§1 — Compact customer card (2 cards on screen).** The picker card is
restructured so the name + Outstanding sit on one row: the priority
chips (High-balance tag, dues badge) move to their own 24px / 11px row
below the identity + figures row, rendered only when at least one chip
exists. The three action buttons share ONE row — Call / Location flex
1, Collect flex 1.5, all 40px — and Collect is flat dark emerald
(`var(--ds-brand)`) in the modal only.

**§2 — One-row banner.** Today / Round / Day Summary stay one 3-cell
flex banner; the progress track moves to its own strip below the row
(`order: 4`), the bar is centred, slate-50 with a `var(--ds-border)`
edge and 10px radius. The title ⚡ becomes a 16px Zap SVG beside the
text (the i18n applier now writes into a child span instead of wiping
the icon), and 📊 becomes a 14px BarChart3 SVG on Day Summary.

**§3 — Recent bar.** The Recent toggle stops clipping: margin-top 8px,
height 38px, label nowrap + ellipsis. (The global 44px button floor
needed a modal-scoped `min-height: 38px!important` override.)

**§4 — One scrollbar.** The list's scrollbar visuals are hidden
(`scrollbar-width: none` + `::-webkit-scrollbar`); the 460px cap and
`overflow-y: auto` stay — the list still scrolls.

**§5 — Mohalla dropdown sorted by dues.** The Quick Collect mohalla
filter now lists mohallas with active dues first (PKR descending),
zero-dues mohallas at the bottom. Equal PKR ties break by the fixed
numbered mohalla order; Unassigned is last inside the (0) group. The
label shortens from "All mohallas (…)" to "All (…)" in this dropdown
only — the customer-search surface keeps list order and "All mohallas".

## Harness measurements (Chromium, 0 pageerrors)

| Size | Badged card | Plain card | Actions | Overflow |
|------|-------------|------------|---------|----------|
| 360×640 | 151.5px | 118px | one row, 40px | 0 everywhere |
| 390×844 | 151.5px | 118px | one row, 40px | 0 everywhere |
| 320×640 | 250.6px | 214.6px | wraps to 2 rows | 0 everywhere |

List shows 2 fully visible + a third 85% visible at 360px (was ~53%).
100-card render: no overlap, no horizontal overflow.

## Honest numbers — please read

- **The saving is 19.1px per badged card (170.6 → 151.5) and 4px per
  plain card (122 → 118) — NOT the ~85px in the request and NOT the
  ~40–45px the prep estimated.** The 2-card goal is met in the list
  viewport (2 full + most of a third; 3.03 all-badged / 3.90
  all-plain per 460px), but the per-card saving is small because the
  chips row costs back most of what the figures row saved.
- **The banner is NOT one row at 360px.** With a day target set the
  three cells need ~442px against 294px of banner content width
  (314px minus 20px padding); even at 390px the button wraps to row
  2. The bar IS shorter (86.4px, was 96.4px) and the track is
  correctly below the row now. Recorded, not blessed (PR #1337
  precedent) — the figures must never be truncated to force it.
- **The action row keeps its wrap valve at 320px.** Three buttons
  need 266px for 236px available; at 320px the third button drops
  to a second row instead of clipping (measured: overX 0, no
  overlap). One row whenever it fits (360/390 measured), graceful
  wrap when it does not — a deliberate deviation from "ONE 3-button
  row" as written.
- **BarChart3, not BarChart2.** BarChart2 does not exist in
  ds-icons.js; BarChart3 is the canonical chart icon (zero pin
  churn).
- **Base moved during this work.** Branched from main 858c8922 (PR
  #1392); PR #1393 (Archive Button) merged to main a2c4fee4 while
  this was in progress. This branch's files do not overlap #1393's
  11 profile files; the parent decides the rebase.

## Deliberate reversals (each rewritten with a why-comment)

1. The QC Cash Modal Overhaul's figures row is gone — figures are
   inline on Row 1 again and the priority chips take their own row
   (the full-width KPI row cost a whole row per card).
2. The QC Modal Fix item 6 action sizing is reversed in the modal
   only (36px icon buttons, Collect flex 1 1 auto → 40px, flex
   1 / 1 / 1.5). The wrap valve itself is KEPT (see above).
3. The Overhaul-2 fit-test C5 pin (figures wrap to Row 2 on
   high-balance cards) is reversed — the figures stay inline and
   the tag moves to the chips row.
4. The mohalla-numbering pin records a §5 exception: numbered order
   is only the tie-break in this ONE dropdown; every other surface
   keeps numbered order.
5. Collect's bright-green gradient stays on the base rule for Field
   Mode, the one-screen save button and the help Got-it button —
   only the modal Collect is flat `var(--ds-brand)`.

## Tests

- Full unit gate: **18,702 pass / 0 fail / 18,702 tests (1032 files)** —
  18,696 baseline + 6 new tests (4 in
  tests/qc-cash-modal-overhaul.test.js, 2 in
  tests/qc4-mohalla-filter-counts.test.js). Gate method, disclosed:
  the first full run scored 18,697/5 with the 5 failures confined
  to the four esbuild-dependent files (build-output,
  build-scanner-safety, manifest-verifier, perf-budget-219) because
  this worktree had no node_modules (tarball checkout). node_modules
  + dist/ were then copied from the Archive worktree
  (package.json / package-lock.json verified byte-identical to base
  858c8922 and to that worktree — the established pattern, no
  `npm ci` was run); the four files re-run 17/0, and no source file
  changed between the runs, so the composed total is 18,702/0.
- Build gate: **PASS** (`node scripts/test-gate.mjs build`, exit 0).
- Focused + neighbour tests: 673 pass / 0 fail.
- Harness: 360×640, 390×844, 320×640 — 0 pageerrors.
- styles.css still exactly 614 distinct hex (no new hex); no new
  tokens needed (`--ds-brand`, `--color-slate-50`, `--ds-border`
  all already exist).

## Diff

14 files, +534/−127 (vs main 858c8922).

- `quick-collect-mohalla-filter.js` — dues-first sort + "All (…)"
- `nav-quick-collect.js` — card restructure (chips row)
- `index.html` — title Zap span, Day Summary BarChart3 span, "All"
  fallback
- `nav-language.js` — ⚡ removed from qc_title strings, applier
  retargeted to the title span
- `styles.css` — title icon, Recent toggle, chips row, banner,
  action row, hidden list scrollbar
- Tests: `qc-cash-modal-overhaul`, `qc-modal-fix`,
  `qc-customer-list-no-crush`, `qc4-mohalla-filter-counts`,
  `mohalla-numbering`, `plan446-quick-collect-mohalla-filter`,
  `mobile-nav`, `bulk-collect`, `qc-modal-overhaul-2-fit`
  (measured numbers updated: 151.5 / 118px, banner 86.4px,
  third card 85% visible; form overage 1,312px carried over —
  the form step is untouched by this PR).
