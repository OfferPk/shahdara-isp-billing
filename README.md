# Shahdara ISP Billing

**Phase 1 mobile-browser testing preview (web build 1.1.2).** Open [offerpk.github.io/shahdara-isp-billing](https://offerpk.github.io/shahdara-isp-billing/). Android packaging remains deferred until browser testing is complete; no APK is published in this phase.

## Privacy and starter data

The public preview and repository include exactly the supplied 74 starter customer names. Those names are visible to anyone because the repository and site are public. Starter addresses, phone numbers, package details, monthly costs/selling prices, bills, payments, and complaint/outage histories are blank. No demo ledger is preloaded.

Customer/profile edits and billing/outage records are saved in local browser storage on the device/browser where they are entered. There is no account, backend, billing-data upload, or automatic sync between devices. The app's first visit needs a connection to load the site; its service worker caches the app for later offline visits. Local browser storage is not an independent backup—TXT exports are generated only when the operator requests them. A cache-version update does not erase saved customer data.

## Phase 1 features

- Exact 74-name seed order; stable sequential customer numbers; customer add/delete; global partial search by name, optional phone/address, or number.
- Per-customer editable address/optional phone, package/speed, monthly provider purchase cost, and one monthly selling amount; profit is expected package margin, not collected cash profit.
- One monthly bill per configured customer beginning in the saved price's effective local month, without backfilling months before a price is entered. When a bill for the current month exists, a price edit begins next month. Each generated month keeps its price snapshot; explicit per-month bill corrections remain possible and are recorded in history.
- Actual payments remain individually editable/deletable. Overpayments first cover the selected month's saved bill, then apply as non-cash credit to later unpaid generated bills. Any unused balance stays attached to the original receipt and remains valid indefinitely, including beyond the visible 24-month billing history. Corrections/deletions recalculate downstream allocations; source receipt/date/method remain available for audit. Cash collection counts the actual receipt once; the separate unused-prepaid-credit dashboard amount is neither cash nor outstanding due.
- An all-customer Transactions page lists every saved actual receipt and can filter by actual payment date. The selected-month report offers Paid, Unpaid/Pending, Partial, and Not set; Not set bills are not invented or classified as unpaid. It shows customer-wide unused prepaid credit and the originating receipts separately from monthly cash.
- Dashboard totals for customers; actual collection within the retained 24 billing months; outstanding due; today's and previous-month actual receipts by payment date across saved receipts; this month's due; expected monthly package profit; and unapplied prepaid credit, explicitly separate from cash and due.
- Every money value and entry label is explicitly PKR, with readable digit grouping and cents only where present; the app performs no currency conversion and seeds no amounts.
- On narrow screens, this month's due, total due, and today's collection appear first. Global search stays above the dashboard, and its Add payment shortcut focuses the selected customer's current-month payment field. Search and primary actions use phone-friendly touch sizes.
- Local TXT exports of recorded payments and full customer history, including allocation destinations, manual complaint/outage history, and correction details.
- Manual complaint/outage history with per-customer rolling 30-day counts. The app does not monitor routers, internet or connectivity.
- Installable, offline-ready browser/PWA experience. Versioned asset URLs, early worker-update registration and query-insensitive cache matching protect existing installs from mixed-version HTML/CSS/JavaScript.

## Local checks

Requires Node.js 22 (or a compatible modern Node release):

```sh
npm ci
npm test
npm run build
python3 -m http.server 8080 --directory dist
```

Open `http://localhost:8080`. Service workers require localhost or HTTPS. Tests cover the blank 74-name seed, search/stable numbers, profile persistence, dashboard/report math, bill schedules/snapshots, partial/exact/overpayments, credit carry chains and indefinite balances past 24 months, payment edits/deletion, TXT exports, manual incident history, and versioned offline assets.

## Android

The owner asked to test the mobile browser site before starting an APK build. Android packaging is intentionally not built or published in this phase; revisit it after browser testing and final feature changes.
