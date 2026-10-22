# Easypaisa Email Reader - Google Apps Script Integration

Free, offline-friendly integration for reading Easypaisa payment notifications from Gmail, storing them in Google Sheets, and syncing them into the Shahdara ISP Billing app.

Part of GitHub Issue #305 (OfferPk/shahdara-isp-billing).

---

## Architecture & Privacy Guarantee

- **100% Private to Your Google Account**: The script runs exclusively inside your own personal Google Apps Script project. No credentials, tokens, or passwords are ever sent to any external server or saved in the billing app.
- **Gmail Authorization Scope**: The script uses Google's built-in `GmailApp` service to search for Easypaisa notifications and apply the `crm-processed` label. Google's standard authorization dialog will display that the script can access Gmail messages and labels; the script contains only read and label operations and never deletes or sends emails.
- **Privacy Notice for Published CSV**: When publishing your sheet as a CSV (Step 5), the generated link is unlisted but public to anyone who possesses the exact link URL. Keep this URL confidential and enter it only into your local billing app settings.
- **Zero Cost**: Built on standard Google Apps Script and Google Sheets (no paid third-party SMS or email parsing APIs).
- **Offline-Friendly CRM Sync**: The CRM app reads the published CSV directly in your local browser sandbox to display totals, match customer payments, and record ledger entries.

---

## 5-Step Setup Guide

### Step 1: Create a Google Sheet
1. Open [Google Sheets](https://sheets.new) in your browser.
2. Name the spreadsheet `Easypaisa Payments` (or any name you prefer).

### Step 2: Paste the Integration Script
1. In the Google Sheets menu, click **Extensions** > **Apps Script**.
2. Erase any default code in `Code.gs`.
3. Copy the entire contents of [`Code.gs`](./Code.gs) and paste it into the editor.
4. **(Required)** At the top of `Code.gs`, set `OWNER_NUMBER` to **your own** Easypaisa number — the script ships with a placeholder and cannot tell Sent from Received until you replace it:
   ```javascript
   OWNER_NUMBER: '03XXXXXXXXX', // <-- REQUIRED: replace with YOUR OWN Easypaisa number (11 digits)
   ```
5. Click the **Save** icon (diskette icon) or press `Ctrl + S`.

### Step 3: Authorize and Run `setup()`
1. In the Apps Script toolbar, make sure **`setup`** is selected in the function dropdown.
2. Click **Run**.
3. Google will show an **"Authorization required"** prompt:
   - Click **Review permissions**.
   - Choose your Google account.
   - Click **Advanced** > **Go to Untitled project (unsafe)** (standard Google Apps Script warning for your own personal scripts).
   - Click **Allow**.
4. The `setup()` function will:
   - Create the `Easypaisa Transactions` sheet tab with styled header columns.
   - Create the `crm-processed` label in your Gmail.
   - Install a background trigger running automatically every 10–15 minutes.

### Step 4: Perform an Initial Test Sync
1. In the Apps Script function dropdown, select **`processEasypaisaEmails`** and click **Run**.
2. Check the **Execution log** at the bottom:
   - It will display how many threads were found, how many new rows were appended, and any duplicates skipped.
3. Switch back to your Google Sheet to view the imported transaction rows!

### Step 5: Publish Sheet as CSV & Connect to CRM
1. In your Google Sheet, click **File** > **Share** > **Publish to web**.
2. Under "Link", choose:
   - Sheet: `Easypaisa Transactions`
   - Format: **Comma-separated values (.csv)**
3. Click **Publish** and copy the generated link (it will look like `https://docs.google.com/spreadsheets/d/e/.../pub?gid=...&single=true&output=csv`).
4. In the Shahdara ISP Billing web app:
   - Navigate to **Payments Inbox** (`#/easypaisa`) or Settings.
   - Paste the published CSV URL into **Easypaisa Sheet CSV URL**.
   - Your incoming payments will now populate the Payments Inbox automatically with today's totals and customer phone matching!
5. In the app's Payments Inbox **Settings**, also enter the **same** Easypaisa number you put in `OWNER_NUMBER` — the app uses it to label rows Sent vs Received, exactly like the sheet does.

> **Safety note:** rows whose amount/total look like a phone number or an implausible figure, or whose first column is a date instead of a Transaction ID, are imported as **Needs review** rather than recorded as money — check those rows by hand instead of trusting a shifted CSV column.

---

## Spreadsheet Column Schema

| Column | Header | Description |
|---|---|---|
| **A** | `Transaction ID` | Unique Easypaisa transaction ID (deduplication key) |
| **B** | `Date & Time` | Timestamp reported in notification |
| **C** | `Date` | ISO Date `YYYY-MM-DD` (PKT) |
| **D** | `Type` | Transaction type (e.g. `Money Transfer to Easypaisa`) |
| **E** | `Direction` | `Received` or `Sent` (resolved via `OWNER_NUMBER`) |
| **F** | `Amount (PKR)` | Transaction amount |
| **G** | `Fee (PKR)` | Service fee (defaults to 0) |
| **H** | `Total (PKR)` | Total amount (Amount + Fee) |
| **I** | `Sender Name` | Sender name |
| **J** | `Sender Number` | Normalized 11-digit mobile (`03XXXXXXXXX`) |
| **K** | `Receiver Name` | Receiver name |
| **L** | `Receiver Number` | Normalized 11-digit mobile (`03XXXXXXXXX`) |
| **M** | `Status` | `Parsed` or `Needs review` |
| **N** | `Notes / Reason` | Details for manual review if unparsed |
| **O** | `Processed At` | ISO timestamp of script execution |

---

## Troubleshooting

- **No emails found**: Ensure you have received notifications from Easypaisa (`from:easypaisa` or `from:no-reply@easypaisa.com.pk`). If testing older emails, remove the `crm-processed` label from them in Gmail.
- **Direction shows Unknown**: Double-check that `OWNER_NUMBER` in `CONFIG` is your exact 11-digit mobile number, and that the **same number** is saved in the app under Payments Inbox > Settings ("Your Easypaisa number"). The app no longer ships with anyone's number pre-filled.
- **Duplicate Prevention**: The script inspects Column A for existing transaction IDs before appending. Even if a message is re-checked, duplicate records are strictly skipped.
