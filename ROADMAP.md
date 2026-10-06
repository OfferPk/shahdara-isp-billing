# Shahdara ISP Billing — Product Roadmap

**Scope:** The separate offline-first PWA repository `OfferPk/shahdara-isp-billing` (currently deployed through GitHub Pages). This roadmap does **not** apply to Shahdara's cloud portal.

**Product goal:** The owner should be able to manage ISP cash, customer ledgers and business accounts from a phone in roughly 10–20 seconds, even without internet.

**Status (2026-10-07):** v1.4.9 was the previously verified public GitHub Pages baseline. v1.5.0 completes Phase 4, passes all 197 automated tests, and builds successfully; a clean-origin desktop preview confirms the new analytics and Area Intelligence UI. Phases 1–4 are implemented; Phases 5–7 remain planned.

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

**Verification (v1.5.0 release candidate):** All 197 automated tests pass; JavaScript syntax checks and the production build pass; the fresh-origin desktop browser smoke check confirms the trend charts, Area Intelligence heading, date controls and empty-ledger states, with no browser console errors. Narrow-screen CSS stacks charts and keeps wide analytics tables horizontally scrollable; the app remains browser-local and existing customer/billing records are not migrated or rewritten.

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

## Implementation tracking

Update this document as phases are completed, tested and released. Record the release tag and the tests/build result next to each completed phase. Never mark a feature complete based only on helper code before its UI, persistence/backup behavior, mobile accessibility and end-to-end tests are verified.
