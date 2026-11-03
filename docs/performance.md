# Runtime performance (Plan F)

Plan F is about how fast a rendered page paints. It is not about
how many rows a page holds — that is Plan Y — and it does not
redo bundling: the first-load request budget in build.mjs
(PERF_BUDGET, perf-budget-219 test) stays enforced, not loosened.

## What changed

List rendering in app.js renderTransactions(), via
list-rendering.js (pure, no DOM):

- `indexCustomers(customers)` builds one Map per render,
  first occurrence winning, exactly like Array.find().
- `resolveTransactionCustomer(tx, index)` resolves one
  visible row with one index lookup plus that row's own
  bill/payment finds. Before Plan F, renderTransactions()
  scanned the whole roster once per visible row
  (O(page x roster)); now it scans it once per render and
  then looks rows up (O(roster + page)).

Markup itself is built for paged.items only, in both
renderCustomers() (active cards and table rows) and
renderTransactions() (transaction cards). renderCustomers()
was already paged for the active roster; Plan F pins that
with contract tests instead of changing it.

## What is page-proportional, and what is not

Aggregation that must be correct for the whole filtered list
is NOT page-sized, and must not be faked: counts, totals, and
full-day header totals still scan the filtered list, because
shrinking them to the page would change the numbers on
screen. The archived panel is also untouched here: its
unbounded `.map(...)` is Plan Y's paging work, not Plan F's.

## What was investigated and deliberately not done

- Payment-allocation caching across renders was rejected:
  allocations are recomputed per render because no audit
  proved that every in-place state mutation reassigns the
  state object, so a cache keyed on state identity could go
  stale. A faster-but-wrong ledger is not a performance win.
- Grouping transactions by day was left on the full filtered
  list: day headers show full-day counts and totals, so
  grouping only the page would change those headers.
- **Lazy-loading png-receipt.js was built, measured, and
  then reverted, on purpose.** The loader followed the
  lazy-qa.js / lazy-telecom.js pattern and worked, but the
  build grew from 24 to 26 dist files (the PNG chunk plus a
  re-split shared chunk) and first-load requests from 23 to
  25, against a budget of 25 files — the perf-budget-219
  test ("dist ships 26 files, budget is 25") failed. The
  budget is not loosened for this plan, and no dist file
  may be deleted to make room, so png-receipt.js stays a
  static import in this PR. A future plan that frees a
  dist slot (for example by consolidating a first-load
  entry script) could revive the lazy split; that work is
  not claimed here.
- Thermal-printer.js was left static for a different
  reason: its `isWebBluetoothAvailable()` check runs
  synchronously during transaction/profile markup, so
  lazy-loading it would force that markup async for a
  ~19 KB module — a behaviour risk for a marginal saving.

## How to verify

```sh
npm ci
node scripts/test-gate.mjs unit
node scripts/test-gate.mjs build
```

The unit gate must report 0 failures, and the build gate
must pass with the first-load budget intact. Playwright e2e
runs in CI; it cannot run in a bare VM without browsers.
