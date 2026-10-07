# Shahdara ISP Billing — Product Roadmap

**Scope:** The separate offline-first PWA repository `OfferPk/shahdara-isp-billing` (currently deployed through GitHub Pages). This roadmap does **not** apply to Shahdara's cloud portal.

**Product goal:** The owner should be able to manage ISP cash, customer ledgers and business accounts from a phone in roughly 10–20 seconds, even without internet.

**Previous verification (2026-10-07):** v1.5.0 was live on GitHub Pages, with the Area Intelligence controls and v31 service worker publicly verified. Phase 4 passed all 197 automated tests and the production build; a clean-origin desktop preview confirmed the analytics and Area Intelligence UI.

**Current status (2026-10-07):** v1.7.0 is deployed to GitHub Pages from `gh-pages` commit `a4df14d`; the source release is tag `v1.7.0` at `5fa7750`. No-cache public HTTP checks returned 200 for the HTML shell, `sw.js` and `backup-store.js`, and verified the v1.7.0 controls, worker v33 and offline-module precache. The in-app browser profile still displayed its cached v1.6.0 shell after a normal reload; no site data or caches were cleared. Phase 9's web implementation passed 205 tests, build/syntax checks and a clean-origin smoke test; native Android compilation and real-device quota/resume testing remain pending because this computer has no Android SDK. Phases 1–4 and 8 are implemented; Phase 9 web support is released with Android acceptance pending; Phases 5–7 and 10–14 remain planned.

## Non-negotiable data and safety rules

- Keep billing, receipts, expenses, profiles, analytics and command answers local to this browser/device; no cloud/AI query dependency and no network request containing ledger data.
- Never alter, seed, guess or fabricate existing customer, bill, receipt, expense, package, connection, area or staff data. Historical records remain unchanged. Missing values must be shown as “Not recorded”, “Not set” or “Insufficient history”.
- Use the existing validated backup and preview-before-merge path. Additive migrations must preserve the original stored bytes when validation fails; conflicting backup data must be shown, never silently overwrite local values.
- Cash collection means actual saved receipts grouped by their actual payment dates. Bill charges, prepaid credit, payroll estimates, inventory book value and expected package margin are not new cash receipts. Profit labels must disclose their exact basis.
- Current manual Active/Offline status is not historical status. Historical comparisons may use a dated snapshot only when one actually exists; otherwise clearly mark the value unavailable or explicitly current-as-of date.
- WhatsApp actions only prepare a user-reviewed `wa.me` draft after an owner tap. No message is sent automatically, no country code is guessed, and no contact is made in the background.
- Voice commands are read-only. Speech recognition may run only with a verified on-device model and `processLocally=true`; never fall back to cloud speech recognition. If the browser or Urdu/Roman Urdu model is unavailable, keep text commands available and explain the limitation. Voice must never change customer or financial data.
- Publish only after tests/build, offline asset checks, mobile/accessibility review, and a safe GitHub-token-based release. Do not enable the GitHub connector for this repository.

## Phased delivery

### Phase 1 — Safe close and daily owner command center

- Correct the new catalog price for **3Mbps / 100GB to PKR 1,000**. Apply to future bill selections only; retain the previous PKR 100 snapshot solely for historical bill/receipt compatibility. Do not rewrite old bills, receipts or amounts.
- Automatically save a local monthly closing when the owner first opens the PWA in a new Pakistan-local calendar month (offline apps cannot run while closed). Snapshot total non-archived customers, total bills including unpriced bills, priced/unpriced counts, billing amount, actual collection, pending balance, expenses, cash profit (collection minus recorded expenses), save time, and previous-month comparison. Preserve saved snapshots across backup/restore; never silently overwrite a conflicting close.
- Add the offline, rule-based **Owner Command Center** for typed English, Urdu and Roman Urdu questions, including monthly collection, a named customer’s bill/balance, today’s unpaid list, daily collection/expenses, monthly cash profit, area pending when area data exists, and customers above an outstanding threshold. Use only local records; unsupported questions explain what data is missing.
- Provide phone-first Home cards for today’s collection, pending, customer count, recorded expenses and cash net profit. Add bottom navigation: **Home | Customers | Collection | Reports | More**. “More” contains secondary views such as Analytics, Inventory and Expenses.
- Make the Home command answer concise and traceable to the local records; distinguish service-month billing from receipt-date cash.

**Acceptance:** Month rollover creates one repeat-safe snapshot; totals reconcile with existing billing/expense helpers; backups preserve and conflict-check snapshots; the 3Mbps/100GB price changes only forward; command parsing has English/Urdu/Roman Urdu tests; the app remains usable offline and on a narrow phone.

### Phase 2 — Customer 360, health, behavior and rankings

- Bring **Customer 360** into one profile experience: current bill, actual total paid, outstanding, unapplied advance/credit, payment history, package, address, notes, last payment and month-by-month history. Do not call credit a payment or invent blank fields.
- Calculate a transparent **Customer Health Score (0–100)** with **Good / Risk / Critical** categories using payment regularity, overdue history, outstanding, partial payments and average delay. Show score, category, history basis and reasons on the profile and customer list. Insufficient due-date/history data must not be presented as a confident score.
- Show payment-behavior analytics based on recorded bills/receipts: average monthly payment and its denominator, average payment delay and sample count, highest/lowest actual payment, late-payment count, partial-payment count, payment consistency and total receipt history. Do not change billing logic.
- Add mobile-friendly rankings: highest-paying, most-consistent, longest-standing, highest-value package, highest outstanding, longest overdue and repeat late payers. Add month, area, package and customer/service-status filters only for recorded dimensions. Historical package ranking requires a saved historical package/rate snapshot.

**Acceptance:** Reconcile each metric to existing saved data, document its denominator, retain current bill behavior, handle missing due dates/history explicitly, and verify filters and keyboard/screen-reader access.

### Phase 3 — Smart Dues Recovery, follow-ups and local alerts

- Add a **Smart Dues Recovery** queue for unpaid/partially paid balances, ranked using outstanding amount, recorded overdue duration, payment/health history, previous late payments and recorded customer value. Show **High Priority / Medium Priority / Low Priority**, the score reasons, number of customers and recoverable total per group. Link directly to the customer billing history.
- Add a **WhatsApp Follow-up Center** with personalized drafts for friendly reminder, overdue reminder, final reminder and payment confirmation. Include saved customer name, outstanding, saved due date, package and previous balance where available. The owner selects a template and manually opens/reviews the draft; never auto-contact anyone.
- Add transparent local rule-based **Smart Alerts**: flag at least 5 distinct customers with a saved positive balance due today; any customer with positive balances in 2 or more priced bill months; a category whose month-to-date expense is at least 50% and PKR 500 above its same-cutoff average across at least 2 recorded expense months; a decline in distinct billed-customer counts by package between the prior 2 completed months only when all saved bill rows have usable dated package history; or today’s actual receipts below 80% of the mean on at least 2 receipt-bearing same-weekday dates in the prior 4 weeks. Explain fixed rules, suppress or qualify comparisons when history is insufficient, and never treat manual Offline as a verified outage. Alerts are read-only, on-device and do not poll or contact customers.

**Acceptance:** Recovery totals equal recorded positive balances; scores expose their formula; WhatsApp links are customer-bound and require a saved full international number; tests prove no auto-send or background contact. Smart Alerts thresholds, dated-history suppression, Pakistan-local due dates, safe text rendering, direct customer routes and read-only/offline behavior are covered by unit and UI tests.

### Phase 4 — Monthly comparisons and Business Analytics

- Compare any two retained months across billing, receipt-date collection, outstanding, dated expenses, cash profit, active customers, new customers/connections, archived/disconnected customers, package distribution and collection rate. Show absolute and percentage change with clear handling of zero/missing baselines.
- Use a month-close snapshot for historical point-in-time balances/status where one exists. Otherwise label computed outstanding as current-as-of-date and historical active status as unavailable; never backfill current manual status into old months.
- Add **Business Performance Explanations** for why billed revenue, receipt-date collection, outstanding, recorded expenses or cash profit rose/fell. For each comparison, show measured driver amounts and percentage contributions when the available denominator is meaningful (for example, dated expense categories, customer/package bill changes, receipts, or new/settled balances). Clearly separate directly observed facts from any estimate, never claim causation the ledger does not establish, and say “insufficient history/data” when a factor cannot be calculated.
- Add mobile-friendly charts for collection, customer growth, pending, expenses, profit, area-wise revenue and package-wise revenue. Use only recorded inputs and show empty/not-set states.
- Build an **Area Intelligence Dashboard** on the existing Area/Mohalla → optional Zone structure. For each available area/zone show customers, active (only with a valid dated snapshot), monthly billing, collected amount, outstanding, collection rate, average customer value, expenses if attributable/recorded and an explicitly estimated profit. Add month/date-range filters and area comparisons. Do not allocate whole-business expenses to areas without a recorded allocation rule.
- Offer the user-supplied Mohalla names as selectable suggestions only; never assign customers automatically:
  1. MOHALLA CHARYAA
  2. MOHALLA KISHTI
  3. MOHALLA BARRIAN
  4. MOHALLA MALLA
  5. MOHALLA THALII
  6. MOHALLA CHAMYAA
  7. MOHALLA NAKAR
  8. MOHALLA PALALIYAA
  9. MOHALAA BANI
  10. MOHALLA SODAA
  11. MOHALLA HAVELI
  12. MOHALLA CHUDRIYAA
  13. MOHALLA PULL
 14. MOHALLA SHAHDARA PARK

**Acceptance (passed):** Date-range validation and filter rendering, parent/zone roll-ups without double counting, package snapshots by service month, cash collection by receipt date, and explicit “not recorded” handling for area expenses/history are covered by the calculation and UI regression tests. The 14 supplied Mohalla names remain optional suggestions only.

**Verification (v1.5.0 live):** All 197 automated tests pass; JavaScript syntax checks and the production build pass; GitHub Pages serves the Area Intelligence controls and v31 service worker; the fresh-origin desktop browser smoke check confirms the trend charts, Area Intelligence heading, date controls and empty-ledger states, with no browser console errors. Narrow-screen CSS stacks charts and keeps wide analytics tables horizontally scrollable; the app remains browser-local and existing customer/billing records are not migrated or rewritten.

### Phase 5 — Inventory and optional staff records

- Add an offline inventory ledger for ONU, router, cable, connector and other actual items: opening/remaining stock, dated purchase/receive, sale/issue/installation/return/damage, cost and balance by saved unit. Item definitions alone do not add stock; corrections are auditable. Inventory cost is not silently counted as an expense a second time.
- If staff are actually configured later, support salary, advances, attendance, remaining salary and payment history. Do not seed fictional employees or attendance. Separate payroll estimates from actual salary cash expenses and prevent double-counting.

**Acceptance:** Transaction-derived stock and salary balances reconcile; missing staff/item data stays empty; dates and costs are auditable; backup/restore includes the new local records.

### Phase 6 — Permanent receipt numbers

- Generate unique sequential receipt identifiers using an owner-configurable prefix, year and sequence, e.g. `SHD-2026-000001`; allow configuration of the prefix and starting sequence.
- Every newly created receipt gets one stable number. Editing receipt amount/date/method must not renumber it. Existing historical receipts without numbers remain without numbers; never fabricate or renumber a historical identifier.
- Validate uniqueness at creation, restore and merge. If a backup contains a different receipt with a duplicate number, block or expose the conflict; never silently change either historic receipt. Persist counter/configuration on this device and include them in validated backups.

**Acceptance:** Sequential and year-boundary tests, duplicate and merge-conflict tests, stable edit/delete behavior, migration rollback tests, and printed/WhatsApp receipt display tests.

### Phase 7 — Offline voice input

- Add microphone input for supported English, Urdu and Roman Urdu where a browser provides a verified installed on-device model. Convert speech to a text query, let the owner review it, then run the same read-only local command parser.
- Require explicit user action to start the microphone; use only local speech processing; do not download a model automatically or use a cloud fallback. If language support is missing, keep typed commands usable and show an honest explanation. Recognition must never trigger a mutation or send a message.

**Acceptance:** Test language-model unavailable states, offline behavior, recognition-result review, permission denial, read-only command constraints and text-only fallback.

### Phase 8 — Customer Lifetime Value (CLV)

- On each customer profile, calculate actual historical revenue from valid saved receipt rows only; count a repeated non-empty payment ID once, and never add bill charges, forwarded credit or estimated revenue to historical cash collected.
- Show tenure only from the saved connection date and any valid recorded end date. Do not substitute profile creation, first payment, current service status or an inferred connection date; label missing or inconsistent dates honestly.
- Show average monthly revenue as actual historical receipts divided by calendar months from the first valid receipt through the current Pakistan-local month, including months with no receipts. Show that denominator and receipt-history window.
- Show average payment delay as settlement delay for fully settled, priced bill months that have a recorded due date; display the sample count. If the due-date/history basis is insufficient, show “Not available”.
- Show a distinct **Estimated future value · next 12 months** only after at least two receipt-bearing months. Disclose the formula (historical average monthly receipts × 12), as-of period, assumptions and missing attrition/price-change factors; mark it as an estimate, never collected cash or a guarantee.
- Add a customer ranking by actual historical receipts. Show the projection separately and never use an estimate to change the historic-collected rank.

**Acceptance:** Reconcile receipt totals with saved payment history; test duplicate IDs, future/invalid dates, no receipts, sparse months, missing tenure/due dates, estimates, rankings and filters; prove calculations do not mutate customer/billing data or send it over the network; verify profile labels and keyboard/mobile usability.

**Verification (released v1.6.0, tag `v1.6.0`):** All 201 automated tests passed; JavaScript syntax checks and production build passed. Pages build `1637a76` serves the v1.6.0 shell, CLV profile labels and service worker v32; a fresh browser reload reported no console errors. Existing customer/billing records remain read-only.

### Phase 9 — Automatic local backup

- Back up the complete offline application database on a configurable daily or weekly interval, with an honest status, last successful date/time and backup size. Automatic execution may check on app open/resume; do not claim a browser can run while it is closed unless a supported, tested native background mechanism is actually present.
- Add owner-triggered **Backup Now** and **Restore Backup** actions. Create uniquely named, timestamped backup copies; never silently replace an existing backup, and ask for explicit confirmation before any overwrite.
- Keep backup contents on-device; include customers, bills, payments, packages, expenses, inventory, staff, month closes and other persisted data. Preserve the existing validated JSON backup and preview-before-merge restore flow; malformed, unsupported or conflicting data fails closed.
- Design for Android/webview storage limits: use a supported app-private or user-selected document location, request no broad filesystem access, handle absent picker/storage, low quota, interrupted writes and permission denial safely, and report failure without deleting the last known-good backup or changing ledger records.

**Acceptance:** Daily/weekly due checks and settings persist locally; successful timestamp and byte size match the stored snapshot; quota/permission/offline/interruption failures leave the previous backup and ledger intact; no backup is overwritten without confirmation; restore previews validation/conflicts and preserves the existing merge protections; Android and small-device flows pass real storage-limit and app-resume tests.

**Web release verification (v1.7.0, Pages commit `a4df14d`):** The app-private IndexedDB store writes each timestamped snapshot with `add()` and atomically saves its metadata/payload; a quota preflight reserves at least 256 KiB plus size/2%-quota headroom, and write failures preserve all prior snapshots and ledger data. Startup and focus/pageshow/visibility checks use the selected daily/weekly cadence; the UI reports last-success time, JSON byte size, status, manual backup, and a saved-backup preview using the existing validated merge-only flow. Direct no-cache requests to the public Pages root, `sw.js` and `backup-store.js` returned HTTP 200; served content confirms the v1.7.0 controls/import, cache v33 and backup-module precache. The existing public-site browser profile still displayed its cached v1.6.0 shell after a normal reload, so no cache/data was cleared and the static HTTP checks are the public deployment verification. The clean-origin browser test confirmed an automatic first copy, distinct manual copies, status/size, daily preference surviving reload, and preview canceled without applying. All 205 automated tests and the static build/syntax checks pass. `cap sync android` succeeded, but `android:debug` stopped because no Android SDK/`ANDROID_HOME` is configured; therefore the native build, small-device rendering, real quota exhaustion, and Android app-resume criteria remain explicitly unverified, and Phase 9 must not be marked fully accepted yet.

### Phase 10 — Duplicate customer detection

- Before a new profile is saved, locally compare the entered identifying values with existing saved records, including normalized phone number, name and address, plus any other identifier that is genuinely present in the schema. Missing values are never guessed.
- If a possible match exists, show the existing customer and the matching fields/reason. Let the owner open that profile or explicitly continue creating a separate record; explain that similar names or shared addresses can be legitimate.
- Never merge, overwrite or delete customer records automatically. Duplicate checking is advisory and offline-only; it does not change existing billing or payment history.

**Acceptance:** Cover exact and normalized phone/address/name matches, partial or ambiguous matches, empty fields and false positives; prove the owner can reach the existing profile or deliberately continue, and that neither choice silently merges, overwrites or deletes records or causes any network request.

### Phase 11 — Business Health Score

- Show an **0–100 analytical indicator** based only on available saved business metrics: receipt-date collection rate, outstanding-balance ratio, cash-profit margin, recorded-expense ratio, dated customer growth and documented churn. Define the observation windows, denominators, thresholds and weights in the UI.
- Break the score into clearly labeled positive and negative factors with each measured value, direction, contribution and data basis. Missing or unreliable inputs are **Not available**, not zeros; disclose the available-factor count and any renormalization used.
- Use only dated customer additions/connections, cancellations, archive events and retained close snapshots where available. Current manual Active/Offline status is not historical churn or a verified outage. Cash profit uses actual saved receipts minus recorded dated expenses, not billed amounts or package-margin projections.
- Keep the score read-only and local. State alongside the score that it is an analytical indicator based on recorded data—not a financial guarantee, credit decision or forecast.

**Acceptance:** Formula and factor contributions reconcile with existing report metrics for each stated period; tests cover zero denominators, missing dates, incomplete history, gains/losses and sparse snapshots; historical churn never uses present manual status; calculation does not mutate records or transmit data; labels and breakdown are accessible on phones.

### Phase 12 — Customer Growth Targets

- Let the owner set and edit local monthly, quarterly and yearly customer-growth targets. Goal settings are separate from the customer ledger and never change historical actuals.
- Show actual customer count, period target, customers remaining to the target, growth percentage and progress. Define whether each saved goal means net new records in that period or a period-end customer total; display its baseline and period so the measure cannot be mistaken for the other.
- Compare actual growth with the immediately previous matching period using dated saved customer events only; show “Not available” rather than inventing a historical baseline. Include simple responsive progress charts, with labels and actual values available to assistive technology.

**Acceptance:** Monthly/quarterly/yearly goal settings persist locally and do not mutate customer records; counts, remaining totals, progress and prior-period changes reconcile for zero, negative, incomplete and exceeded targets; charts remain readable on mobile; missing event dates do not create estimated actuals.

### Phase 13 — Customer Anniversaries

- Preserve an explicit original joining/installation date as the anniversary anchor. Use an existing valid saved connection date only when it is genuinely the original date; do not infer one from profile creation, first bill, first payment or current service state. If the original date is missing or corrected, retain an explicit owner action and audit-safe behavior rather than silently moving past milestones.
- Calculate customer tenure and annual milestones (1, 2, 3 years and onward) from the saved anchor. Show the next/upcoming anniversary and milestone on the customer profile and owner dashboard; display dates only, with no automatic contact, messaging or service change.
- Keep date handling explicit for incomplete or invalid dates and February 29 anniversaries; all calculations are local and use the app’s established Pakistan timezone.

**Acceptance:** Test missing/invalid/original dates, date corrections, leap-year and year-boundary milestones, tenure, upcoming-dashboard ordering and mobile accessibility; preserve unrelated customer/billing history and confirm that reminders never send any message or initiate contact.

### Phase 14 — Customizable Owner Home Dashboard

- Let the owner choose which dashboard cards/widgets are visible, save a local widget order, and set the default date range on this device. Keep preferences separate from customer/billing facts; provide a clear reset-to-default action.
- Support drag-and-drop reordering where available and accessible keyboard/tap move-up/move-down controls as a fallback. Hidden widgets remain available from the customization controls.
- Offer widgets for Today’s Collection, Outstanding, Profit, Expenses, Customer Count, Collection Target, Alerts, Quick Actions and Recent Transactions. Respect existing local data definitions: actual receipt dates, actual dated expenses, current recorded balances and explicitly configured targets; label unavailable history.
- Add customizable **Favorite Actions** that the owner can pin, reorder or remove: Add Customer, Receive Payment, Add Expense, Create Receipt, Search Customer and Reports. Keep favorites prominent for one-tap navigation/action while preserving existing intentional form submission and receipt review steps.
- Keep widget layout, date-range preference and favorites local/offline; preserve existing ledger and reporting behavior.

**Acceptance:** Visibility/order/date-range and favorite choices persist on this device and can be reset; all widgets and favorites can be reordered without drag-and-drop; shortcuts open the intended existing local task without skipping its normal review/submit safeguards; values reconcile with source reports for each range; missing history is not invented; mobile and assistive-technology controls are verified.

## Implementation tracking

Update this document as phases are completed, tested and released. Record the release tag and the tests/build result next to each completed phase. Never mark a feature complete based only on helper code before its UI, persistence/backup behavior, mobile accessibility and end-to-end tests are verified.
