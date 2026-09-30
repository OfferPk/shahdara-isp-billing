# Shahdara ISP Billing

**Follow-up mobile-browser/PWA release · web build 1.2.8**

Open the [live GitHub Pages site](https://offerpk.github.io/shahdara-isp-billing/). Android packaging remains deferred until browser testing is complete; this release does not publish an APK.

## Privacy, starter data and backups

The public repository and site contain exactly the 74 supplied starter customer names, in the supplied order. Those names are publicly visible. Starter address, phone, package/provider, monthly price/cost, service status, bills, receipts and complaint/outage data are blank or unset; no demo ledger is preloaded.

Customer profiles, billing, inventory movements and expenses are stored only in this browser's local storage on this device. There is no account, backend, billing-data upload or cloud/device sync. Clearing site data, changing browsers/devices, browser storage eviction or losing the device can remove records. **Download a JSON backup regularly and keep it somewhere separate.** JSON restore is validated and previewed before a merge; it is merge-only, preserves existing nonblank conflicts, and never silently replaces or deletes existing records. Backup files can contain personal/customer financial data, so store them securely. TXT exports and JSON backups are produced only when the operator requests them.

The first visit needs a network connection. The service worker caches the static app for later offline use. Cache updates do not clear local customer records; data migrations add default fields while retaining existing billing history, and malformed/unsupported saved data fails closed rather than being overwritten.

## Phase 1/2 web features preserved

- Exactly 74 starter names; stable unique customer numbers; global partial search by name, optional phone/address or customer number. Customer IDs/numbers remain stable after deletion; numbers are never reused.
- Editable optional address/phone, free-text ISP/provider (including a Nayatel suggestion), manual service state (Active / Offline / Not set) with direct color-coded customer-card choices, package/speed (5, 10, 15 and 30 Mbps suggestions plus custom text), monthly provider cost and one monthly selling amount. All starter values remain blank.
- Live expected package margin and expected recurring provider-cost totals/breakdowns. Incomplete profiles are excluded and counted; estimates are not collected cash profit or cash paid.
- Automatic monthly bill snapshots begin in the configured effective local month; price edits do not rewrite past obligations. New monthly bills default to the 5th; an explicitly customized due date is respected, and historical snapshots are not backfilled or rewritten. No automatic late penalty is applied. Archived customers retain IDs, bills, receipts, credit and complaints; archiving stops new bills, and unarchiving resumes without backfilling archived months. Permanent delete is separately confirmed and warns that all local history will be removed.
- Actual receipts are editable/deletable and drive Paid / Partial / Pending status; a missing bill amount remains Not set. Customer and report filters cover manual service state and the selected billing month, with global search retained. “Record payment / Mark paid” opens the actual payment form and suggests only the remaining bill balance; the operator must enter the real date and method and submit before any receipt is created.
- Customer cards and profile summaries total recorded receipt rows across saved months, group the month breakdown by actual payment date, and never add bill charges or derived credit to cash received. ISP time is calculated only from the saved connection date; if it is missing or inconsistent, the profile says so instead of using the profile-added or billing-start date. Existing month-by-month billing history remains available.
- A receipt applies to its selected month first, then excess is allocated as non-cash credit to later generated bills. Unused credit remains valid indefinitely, even after its receipt falls outside the visible 24-month window; credit is not another payment. Corrections/deletions recalculate allocations and refresh lists, reports, dashboard, transactions and exports.
- Transactions, customer histories and one-click monthly Paid, Pending, Partial and Not set reports. Reports/history show the retained 24 billing months; aged credit sources remain visible where used and remain available for correction/deletion locally. Cash collection totals count actual receipts only.
- Dashboard includes active customers, actual collections, total/current due, today/previous-month collections, expected package profit, expected provider costs by ISP, service-state counts and unapplied prepaid credit. PKR is explicit throughout; the app performs no currency conversion.
- Manual per-customer complaint/outage records with report/offline/restored times, notes, open/resolved state, edits/deletes and rolling 30-day counts. No network/router monitoring is performed.
- Phone-first controls, accessible form labels, local TXT exports, versioned offline assets and non-destructive migration safeguards.

## Phase 3 web features

- A local inventory register with manually entered ONU, router, fiber-cable, connector, adapter/power-supply or custom items. Item definitions add no stock. Dated receive, install/issue, return, damage and corrected stock movements determine available, installed, returned and damaged quantities. Unit of measure, minimum stock, optional unit/acquisition cost, notes and optional customer assignment are recorded. Available-stock value is unit cost multiplied by available quantity; it excludes installed, damaged and returned equipment. Categories with no movement history display as not recorded.
- A local expense ledger for the requested provider, utility, salary, cable, equipment, repair, OLT, tool, RADIUS and other-expense categories. Only actual positive amounts with manually entered payment dates count. Corrections are editable and deletion is confirmed; inventory cost and expected provider costs are excluded from cash expenses.
- Local owner-entered payroll tracking: Saad's base is PKR 15,000/month, with PKR 200 per customer newly added after 2026-09-30 only while the profile is manually Active, unarchived, and the selected-month bill is fully paid. Partial/unpaid bills do not count; Offline/archive/drop removes the increment, and reactivation counts again when eligible. Existing 74 starter customers are excluded. Saad attendance is a unique manually logged date count only, not a salary multiplier. Umair's calculated monthly workday amount is PKR 1,000 per unique manually logged work date; no unlogged date is assumed.
- Payroll summaries and attendance/workday dates are not cash transactions and do not enter actual expense/chart totals. To include a salary payment in cash reporting, the owner separately records the actual dated payment once in the existing expense ledger. These date records are stored locally and included in the validated JSON backup; there is no server sync.
- Optional, blank-by-default area / mohalla and zone fields use an explicit parent-area → optional-zone hierarchy; addresses are not treated as areas, and profiles without an area are counted separately from named-area rows. Comparison keys normalize Unicode, trim and collapse whitespace, and match case-insensitively without fuzzy-merging distinct names. Parent roll-ups and their nested child rows are labeled as separate levels and are not meant to be added together.
- Package labels normalize the preset 5/10/15/30 Mbps speed variants and trim/case-normalize custom names without merging distinct labels. The area, package and overall ARPU consistently equals the current PKT service-month bill snapshot amounts divided by active configured subscriptions; manually Offline customers remain included, while unset/unpriced, not-yet-effective, expired, explicitly cancelled and archived subscriptions are excluded and counted. It is not collected cash or a nominal-price estimate; missing snapshots and ARPU remain Not set.
- PKT-based six-month charts show bill-snapshot revenue vs receipt-date cash, recorded customer growth, dated month-end outstanding snapshots, current manual Active/Offline status and actual cash income vs actual dated expenses. Forecasts include eligible offline subscriptions with configured next-month rates. Live Active/Offline/Not set counts are calculated from saved nonarchived profiles and embedded in their service-filter buttons; billing-state filters remain independent. Online percentage excludes Not set profiles and shows its denominator. Empty history is labeled no entries/not set rather than a fabricated zero. Offline alone is not churn.
- Inventory, expenses, optional profile fields and package history are included in the validated, preview-before-merge local JSON backup. Charts use bundled SVG; no external visualization assets or billing-data network calls are used.

## Local checks

Requires Node.js 22 or a compatible modern Node release:

```sh
npm ci
npm test
npm run build
python3 -m http.server 8080 --directory dist
```

Open `http://localhost:8080`. Service workers require localhost or HTTPS. The automated suite covers the 74-name order, profiles and stable numbers, PKR calculations, status/report and provider-cost behavior, monthly snapshots, credit chains and corrections, archive/resume gaps, fifth-of-month defaults at month/year boundaries, custom and historical due-date preservation, salary eligibility after full payment and status transitions, baseline exclusion, unique manual date logs, selected-month totals, no fabricated entries or cash double counting, complaints, Phase 3 inventory/expense movements, Unicode/case/space-normalized location and package grouping, distinct nested zones, unique snapshots, exact ARPU eligibility and Offline inclusion, forecasting, PKT month-end snapshots, backup/migration safety and offline asset versions. The web bundle contains no Android package.

## Android

The owner asked to test the web app in a mobile browser before building an APK. No Android APK is built or published in this phase.
