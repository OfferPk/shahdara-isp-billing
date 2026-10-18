# Feature & Interactive Control Status (Automated Button Audit)

*Last updated: 2026-10-18T23:08:27.031Z via tests/e2e/button-audit.spec.mjs (#216)*

**Summary:** 61 / 61 controls verified working (0 no-effect buttons, 0 broken).

| # | Route | Control / Element | Target / Selector | Observed Effect | Status |
|---|---|---|---|---|---|
| 1 | `/` | Receive Payment tile | `#quickActionReceivePayment` | Opens Quick Collect modal (#quickCollectModal) | **Working** |
| 2 | `/` | Monthly Report tile | `#quickActionMonthlyReports` | Navigates to #/reports and reveals #billingReportsView | **Working** |
| 3 | `/` | Record Expense tile | `#quickActionRecordExpense` | Navigates to #/expenses and reveals #expensesView | **Working** |
| 4 | `/` | Add Customer tile | `#quickActionAddCustomer` | Opens Add Customer dialog (#addCustomerDialog) | **Working** |
| 5 | `/` | Area Intelligence tile | `#quickActionAnalytics` | Navigates to #/analytics and reveals #analyticsView | **Working** |
| 6 | `/` | Billing Audit tile | `#quickActionBillingCorrectness` | Opens Billing Audit dialog (#billingCorrectnessModal) | **Working** |
| 7 | `/` | Daily Register Closing Slip tile | `#quickActionDailyClosingSlip` | Copies slip and opens Daily Closing modal (#dailyClosingModal) | **Working** |
| 8 | `global` | Theme Toggle (Light/Dark) | `#themeToggle` | Switches document data-theme to dark | **Working** |
| 9 | `global` | Language Toggle (English/Urdu) | `#languageToggleBtn` | Toggles html lang="ur" and dir="rtl" | **Working** |
| 10 | `global` | Navigation Drawer Toggle | `#navDrawerToggle` | Opens navigation drawer sidebar (#navDrawer) | **Working** |
| 11 | `drawer` | Drawer item: Customers | `#navDrawer [data-nav-target="customers"]` | Navigates to #/customers and closes drawer | **Working** |
| 12 | `/#/home` | Add Payment Button | `#quickAddPaymentButton` | Opens Quick Collect modal | **Working** |
| 13 | `#/customers` | Add Customer Button | `#addCustomerButton` | Opens Add Customer modal dialog | **Working** |
| 14 | `#/customers` | Export Customer Roster CSV | `#exportCustomerRosterCsvBtn` | Downloads customer roster CSV file | **Working** |
| 15 | `#/transactions` | Clear Transaction Filters | `#clearTransactionFilters` | Resets transaction filters to defaults | **Working** |
| 16 | `#/transactions` | Export Transactions CSV | `#exportTransactionsCsvBtn` | Downloads transactions ledger CSV file | **Working** |
| 17 | `#/reports` | Export Monthly Report CSV | `#exportMonthlyReportCsvBtn` | Downloads monthly report CSV file | **Working** |
| 18 | `#/reports` | Batch Print Slips Button | `#batchReceiptPrintBtn` | Opens Batch Receipt Slips modal (#batchReceiptModal) | **Working** |
| 19 | `#/expenses` | Export Expenses CSV | `#exportExpensesCsvBtn` | Downloads expenses CSV file | **Working** |
| 20 | `#/expenses` | Clear Expense Filters | `#clearExpenseFilters` | Resets expense filters to default | **Working** |
| 21 | `#/inventory` | Export Inventory CSV | `#exportInventoryCsvBtn` | Downloads equipment inventory CSV file | **Working** |
| 22 | `/#/home` | navDrawerToggle | `#navDrawerToggle` | Opened dialog | **Working** |
| 23 | `/#/home` | mobileCustomerSearchTrigger | `#mobileCustomerSearchTrigger` | Opened dialog | **Working** |
| 24 | `/#/home` | topbarPendingActionsBtn | `#topbarPendingActionsBtn` | Opened dialog | **Working** |
| 25 | `/#/home` | languageToggleBtn | `#languageToggleBtn` | Opened dialog | **Working** |
| 26 | `/#/home` | themeToggle | `#themeToggle` | Opened dialog | **Working** |
| 27 | `/#/home` | dataSafetyShareBackupBtn | `#dataSafetyShareBackupBtn` | Opened dialog | **Working** |
| 28 | `/#/home` | dataSafetyProtectStorageBtn | `#dataSafetyProtectStorageBtn` | Opened dialog | **Working** |
| 29 | `/#/home` | clearGlobalSearch | `#clearGlobalSearch` | Opened dialog | **Working** |
| 30 | `/#/customers` | navDrawerToggle | `#navDrawerToggle` | Opened dialog | **Working** |
| 31 | `/#/customers` | mobileCustomerSearchTrigger | `#mobileCustomerSearchTrigger` | Opened dialog | **Working** |
| 32 | `/#/customers` | topbarPendingActionsBtn | `#topbarPendingActionsBtn` | Opened dialog | **Working** |
| 33 | `/#/customers` | languageToggleBtn | `#languageToggleBtn` | Opened dialog | **Working** |
| 34 | `/#/customers` | themeToggle | `#themeToggle` | Opened dialog | **Working** |
| 35 | `/#/customers` | dataSafetyShareBackupBtn | `#dataSafetyShareBackupBtn` | Opened dialog | **Working** |
| 36 | `/#/customers` | dataSafetyProtectStorageBtn | `#dataSafetyProtectStorageBtn` | Opened dialog | **Working** |
| 37 | `/#/customers` | srPrimaryAction | `#srPrimaryAction` | Opened dialog | **Working** |
| 38 | `/#/transactions` | navDrawerToggle | `#navDrawerToggle` | Opened dialog | **Working** |
| 39 | `/#/transactions` | mobileCustomerSearchTrigger | `#mobileCustomerSearchTrigger` | Opened dialog | **Working** |
| 40 | `/#/transactions` | topbarPendingActionsBtn | `#topbarPendingActionsBtn` | Opened dialog | **Working** |
| 41 | `/#/transactions` | languageToggleBtn | `#languageToggleBtn` | Opened dialog | **Working** |
| 42 | `/#/transactions` | themeToggle | `#themeToggle` | Opened dialog | **Working** |
| 43 | `/#/transactions` | dataSafetyShareBackupBtn | `#dataSafetyShareBackupBtn` | Opened dialog | **Working** |
| 44 | `/#/transactions` | dataSafetyProtectStorageBtn | `#dataSafetyProtectStorageBtn` | Opened dialog | **Working** |
| 45 | `/#/transactions` | srPrimaryAction | `#srPrimaryAction` | Opened dialog | **Working** |
| 46 | `/#/reports` | navDrawerToggle | `#navDrawerToggle` | Opened dialog | **Working** |
| 47 | `/#/reports` | mobileCustomerSearchTrigger | `#mobileCustomerSearchTrigger` | Opened dialog | **Working** |
| 48 | `/#/reports` | topbarPendingActionsBtn | `#topbarPendingActionsBtn` | Opened dialog | **Working** |
| 49 | `/#/reports` | languageToggleBtn | `#languageToggleBtn` | Opened dialog | **Working** |
| 50 | `/#/reports` | themeToggle | `#themeToggle` | Opened dialog | **Working** |
| 51 | `/#/reports` | dataSafetyShareBackupBtn | `#dataSafetyShareBackupBtn` | Opened dialog | **Working** |
| 52 | `/#/reports` | dataSafetyProtectStorageBtn | `#dataSafetyProtectStorageBtn` | Opened dialog | **Working** |
| 53 | `/#/reports` | srPrimaryAction | `#srPrimaryAction` | Opened dialog | **Working** |
| 54 | `/#/expenses` | navDrawerToggle | `#navDrawerToggle` | Opened dialog | **Working** |
| 55 | `/#/expenses` | mobileCustomerSearchTrigger | `#mobileCustomerSearchTrigger` | Opened dialog | **Working** |
| 56 | `/#/expenses` | topbarPendingActionsBtn | `#topbarPendingActionsBtn` | Opened dialog | **Working** |
| 57 | `/#/expenses` | languageToggleBtn | `#languageToggleBtn` | Opened dialog | **Working** |
| 58 | `/#/expenses` | themeToggle | `#themeToggle` | Opened dialog | **Working** |
| 59 | `/#/expenses` | dataSafetyShareBackupBtn | `#dataSafetyShareBackupBtn` | Opened dialog | **Working** |
| 60 | `/#/expenses` | dataSafetyProtectStorageBtn | `#dataSafetyProtectStorageBtn` | Opened dialog | **Working** |
| 61 | `/#/expenses` | srPrimaryAction | `#srPrimaryAction` | Opened dialog | **Working** |

### Notes
- **`#ownerVoiceButton`**: Voice recognition is safely stubbed in headless Chromium environments.
- **Single-Open Dialog Rule (#215)**: Activating a dialog automatically closes prior dialogs while trapping focus.
- **Hash Router Navigation (#212)**: Nav items cleanly update `#/<route>` and scroll to the top.
