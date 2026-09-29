# Shahdara ISP Billing

**Phase 1 mobile-browser testing preview.** Open the public site at [offerpk.github.io/shahdara-isp-billing](https://offerpk.github.io/shahdara-isp-billing/). Android packaging is deferred until browser testing is complete; there is no APK download in this preview.

## Privacy and starter data

The public preview and repository include exactly the supplied 74 starter customer names. Those names are visible to anyone because the repository and site are public. Starter addresses, phone numbers, package details, monthly costs/selling prices, bills, payments, and complaint/outage histories are blank. No demo ledger is preloaded.

Customer/profile edits and all billing/outage records are saved in local browser storage on the device/browser where they are entered. There is no account, backend, billing-data upload, or automatic sync between devices. The app's first visit needs a connection to load the site; its service worker caches the app for subsequent offline visits. Local browser storage is not an independent backup—TXT exports are generated only when the operator requests them.

## Phase 1 features

- Exact 74-name seed order; stable sequential customer numbers; customer add/delete; global partial search by name, optional phone/address, or number.
- Per-customer editable address/optional phone, package/speed, monthly provider purchase cost, and one monthly selling amount; profit is labeled expected package margin, not collected cash profit.
- One monthly bill per configured customer beginning in the saved price's effective local month, without backfilling months before a price is entered. When a bill for the current month already exists, a price edit begins next month. Each generated month keeps its own selling-price snapshot; explicit per-month bill corrections remain possible and are recorded in that customer's history.
- Actual payments remain individually editable/deletable. Overpayments first cover the selected month's saved bill, then apply as non-cash credit to the next unpaid generated bill(s). Credit with no later bill yet remains on its original receipt until a future bill is generated. The original payment is counted as cash once; correction/deletion recomputes every downstream allocation. Old source receipts that are still funding an active carry-credit can be edited/deleted from the receiving bill history even after the source month leaves the 24-month view.
- An all-customer Transactions page lists every saved actual receipt (not derived credit entries) and can filter by actual payment date. The selected-month report offers Paid, Unpaid/Pending, Partial, and Not set; Not set bills are not invented or classified as unpaid.
- Dashboard totals for customer count, actual collection within the retained 24 billing months, total/current-month outstanding due, today's and previous-month actual receipts by payment date across saved receipts, rolling 30-day manually recorded complaints/outages, and expected monthly package profit.
- Local TXT exports of recorded payments and full customer history, including allocation destinations, manual complaint/outage history, and correction details.
- Manual complaint/outage log per customer. There is no device, router, or live internet monitoring.
- Installable offline-ready browser/PWA experience.

## Local checks

Requires Node.js 22 (or a compatible modern Node release):

```sh
npm ci
npm test
npm run build
python3 -m http.server 8080 --directory dist
```

Open `http://localhost:8080`. Service workers require localhost or HTTPS. The test suite covers the starter list and blank seed, search and stable numbers, profile persistence, dashboard/report math, bill scheduling/snapshots, partial/exact/overpayments, credit carry chains and old-credit corrections, payment edits/deletion, TXT exports, and manual incident histories.

## Android

The owner asked to test the mobile browser site before starting an APK build. Android packaging is intentionally not built or published in this phase; revisit it after the browser test and final feature changes.
