/**
 * Google Apps Script - Easypaisa Gmail Reader & Sheets Integration (#305)
 *
 * Runs inside Google Apps Script (V8 runtime) attached to a Google Sheet.
 * Searches Gmail for Easypaisa notifications, parses transaction details,
 * de-duplicates by Transaction ID, and appends rows to Google Sheets.
 *
 * Part of GitHub Issue #305 (OfferPk/shahdara-isp-billing).
 */

// ============================================================================
// CONFIGURATION
// ============================================================================
const CONFIG = {
  // Gmail search query to locate Easypaisa emails.
  // Searches for emails from easypaisa not yet labeled as processed.
  SEARCH_QUERY: 'from:(easypaisa OR "no-reply@easypaisa.com.pk" OR info@easypaisa.com.pk) -label:crm-processed',

  // Gmail label applied to threads once processed so they are not re-read.
  LABEL_NAME: 'crm-processed',

  // Name of the sheet inside the spreadsheet where transactions are appended.
  SHEET_NAME: 'Easypaisa Transactions',

  // Owner mobile number in standard 11-digit format (03XXXXXXXXX).
  // Used to distinguish incoming/received payments from outgoing/sent transfers.
  OWNER_NUMBER: '03XXXXXXXXX', // <-- REQUIRED: replace with YOUR OWN Easypaisa number (11 digits)

  // Maximum number of Gmail threads to fetch per execution cycle.
  BATCH_SIZE: 50,

  // Interval in minutes for the automated background trigger (e.g. 10 or 15).
  TRIGGER_MINUTES: 10
};

// ============================================================================
// SPREADSHEET HEADERS
// ============================================================================
const HEADERS = [
  'Transaction ID',    // Col A: Unique transaction reference (used for deduplication)
  'Date & Time',        // Col B: Raw date string from email (e.g. 13-Oct-2026 14:20:38)
  'Date',               // Col C: ISO Date YYYY-MM-DD (PKT)
  'Type',               // Col D: Transaction Type
  'Direction',          // Col E: 'Received' | 'Sent' | 'Unknown'
  'Amount (PKR)',       // Col F: Net transferred amount
  'Fee (PKR)',          // Col G: Service fee
  'Total (PKR)',        // Col H: Total amount charged / received
  'Sender Name',        // Col I: Sender Name
  'Sender Number',      // Col J: Normalized sender mobile (03XXXXXXXXX)
  'Receiver Name',      // Col K: Receiver Name
  'Receiver Number',    // Col L: Normalized receiver mobile (03XXXXXXXXX)
  'Status',             // Col M: 'Parsed' | 'Needs review'
  'Notes / Reason',     // Col N: Review notes or error explanation
  'Processed At'        // Col O: Timestamp when row was added to sheet
];

// ============================================================================
// SETUP FUNCTION (Run once to initialize Sheet, Label, and Trigger)
// ============================================================================
function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    throw new Error('Please open this script from Extensions > Apps Script inside your Google Sheet.');
  }

  // 1. Ensure transactions sheet exists with headers
  let sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEET_NAME);
  }

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    const headerRange = sheet.getRange(1, 1, 1, HEADERS.length);
    headerRange.setFontWeight('bold');
    headerRange.setBackground('#00796B');
    headerRange.setFontColor('#FFFFFF');
    sheet.setFrozenRows(1);
    sheet.autoResizeColumns(1, HEADERS.length);
  }

  // 2. Ensure Gmail label exists
  let label = GmailApp.getUserLabelByName(CONFIG.LABEL_NAME);
  if (!label) {
    label = GmailApp.createLabel(CONFIG.LABEL_NAME);
    Logger.log('Created Gmail label: ' + CONFIG.LABEL_NAME);
  } else {
    Logger.log('Found existing Gmail label: ' + CONFIG.LABEL_NAME);
  }

  // 3. Setup installable time-driven trigger (10-15 minutes)
  const existingTriggers = ScriptApp.getProjectTriggers();
  for (const trigger of existingTriggers) {
    if (trigger.getHandlerFunction() === 'processEasypaisaEmails') {
      ScriptApp.deleteTrigger(trigger);
      Logger.log('Deleted existing trigger for processEasypaisaEmails');
    }
  }

  ScriptApp.newTrigger('processEasypaisaEmails')
    .timeBased()
    .everyMinutes(CONFIG.TRIGGER_MINUTES)
    .create();

  Logger.log('Installed time trigger running every ' + CONFIG.TRIGGER_MINUTES + ' minutes.');
  Logger.log('SETUP COMPLETE! You can now run processEasypaisaEmails() to perform an initial sync.');
}

// ============================================================================
// MAIN PROCESSING LOOP (Runs automatically via trigger or manually)
// ============================================================================
function processEasypaisaEmails() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    throw new Error('Active spreadsheet not found. Ensure this script is bound to a Google Sheet.');
  }

  let sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) {
    setup();
    sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  }

  let label = GmailApp.getUserLabelByName(CONFIG.LABEL_NAME);
  if (!label) {
    label = GmailApp.createLabel(CONFIG.LABEL_NAME);
  }

  // Retrieve existing transaction IDs to ensure strict de-duplication
  const existingTxnIds = getExistingTxnIds(sheet);
  Logger.log('Found ' + existingTxnIds.size + ' existing transaction IDs in sheet.');

  // Search for matching unprocessed Gmail threads
  const threads = GmailApp.search(CONFIG.SEARCH_QUERY, 0, CONFIG.BATCH_SIZE);
  Logger.log('Found ' + threads.length + ' unprocessed thread(s) matching: ' + CONFIG.SEARCH_QUERY);

  if (!threads.length) {
    Logger.log('No new unprocessed Easypaisa emails found.');
    return;
  }

  let addedCount = 0;
  let skippedDuplicates = 0;
  let needsReviewCount = 0;
  const newRows = [];

  for (const thread of threads) {
    const messages = thread.getMessages();
    let threadHasPendingStatement = false;
    for (const msg of messages) {
      const body = msg.getPlainBody() || '';
      const subject = msg.getSubject() || '';
      const msgDate = msg.getDate();

      const parsed = parseEasypaisaEmailText(body, {
        ownerNumber: CONFIG.OWNER_NUMBER,
        subject: subject,
        dateFallback: msgDate
      });

      // Check if message has PDF statement attachment
      const attachments = (typeof msg.getAttachments === 'function') ? msg.getAttachments() : [];
      const hasPdf = attachments.some(a => {
        const ct = (a && typeof a.getContentType === 'function') ? a.getContentType() : '';
        const name = (a && typeof a.getName === 'function') ? a.getName().toLowerCase() : '';
        return ct.includes('pdf') || name.endsWith('.pdf');
      });

      if (hasPdf && parsed.status !== 'Parsed') {
        Logger.log('Message has PDF statement attachment (' + subject + '); leaving for statement import without marking crm-processed.');
        threadHasPendingStatement = true;
        continue;
      }

      if (parsed.status === 'Parsed' && parsed.txnId) {
        if (existingTxnIds.has(parsed.txnId)) {
          skippedDuplicates++;
          Logger.log('Skipping duplicate transaction: ' + parsed.txnId);
        } else {
          existingTxnIds.add(parsed.txnId);
          newRows.push(buildRowFromTxn(parsed));
          addedCount++;
        }
      } else {
        // Transaction could not be cleanly parsed - flag as Needs review
        const fallbackId = parsed.txnId || ('REVIEW-' + msg.getId().slice(-8));
        if (!existingTxnIds.has(fallbackId)) {
          existingTxnIds.add(fallbackId);
          parsed.txnId = fallbackId;
          newRows.push(buildRowFromTxn(parsed));
          needsReviewCount++;
        }
      }
    }

    // Mark thread as processed only if no statement attachments are pending processing
    if (!threadHasPendingStatement) {
      thread.addLabel(label);
    }
  }

  // Batch append new rows to sheet for performance
  if (newRows.length > 0) {
    const startRow = sheet.getLastRow() + 1;
    sheet.getRange(startRow, 1, newRows.length, HEADERS.length).setValues(newRows);
    Logger.log('Appended ' + newRows.length + ' new row(s) to sheet.');
  }

  Logger.log('Processing summary: Added=' + addedCount + ', NeedsReview=' + needsReviewCount + ', DuplicatesSkipped=' + skippedDuplicates);
}

/**
 * Reads column A of the sheet to build a Set of existing transaction IDs for deduplication.
 */
function getExistingTxnIds(sheet) {
  const lastRow = sheet.getLastRow();
  const set = new Set();
  if (lastRow <= 1) return set;

  const values = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (let i = 0; i < values.length; i++) {
    const id = String(values[i][0]).trim();
    if (id) {
      set.add(id);
    }
  }
  return set;
}

/**
 * Builds an array row matching the HEADERS order.
 */
function buildRowFromTxn(txn) {
  const nowIso = new Date().toISOString();
  return [
    txn.txnId || '',
    txn.datetime || '',
    txn.date || '',
    txn.type || '',
    txn.direction || 'Unknown',
    txn.amount !== null && txn.amount !== undefined ? txn.amount : '',
    txn.fee !== null && txn.fee !== undefined ? txn.fee : 0,
    txn.total !== null && txn.total !== undefined ? txn.total : '',
    txn.senderName || '',
    txn.senderNumber || '',
    txn.receiverName || '',
    txn.receiverNumber || '',
    txn.status || 'Needs review',
    txn.notes || '',
    nowIso
  ];
}

// ============================================================================
// PURE PARSING LOGIC (Mirror of easypaisa-parser.js)
// ============================================================================

const MONTH_MAP = {
  jan: '01', january: '01',
  feb: '02', february: '02',
  mar: '03', march: '03',
  apr: '04', april: '04',
  may: '05',
  jun: '06', june: '06',
  jul: '07', july: '07',
  aug: '08', august: '08',
  sep: '09', september: '09',
  oct: '10', october: '10',
  nov: '11', november: '11',
  dec: '12', december: '12'
};

/**
 * Normalizes phone numbers to standard 11-digit format 03XXXXXXXXX.
 */
function normalizePhone(value) {
  if (!value) return '';
  const str = String(value)
    .replace(/[٠-٩۰-۹]/g, digit => {
      const code = digit.charCodeAt(0);
      return String(code - (code >= 0x06f0 ? 0x06f0 : 0x0660));
    });

  let digits = str.replace(/\D/g, '');
  if (!digits) return '';

  if (digits.startsWith('92') && digits.length === 12) {
    digits = '0' + digits.slice(2);
  } else if (digits.length === 10 && digits.startsWith('3')) {
    digits = '0' + digits;
  }
  return digits;
}

/**
 * Parses numeric currency amount from formatted text (e.g. "Rs. 5000.0").
 */
function parseAmount(val) {
  if (val === null || val === undefined || val === '') return null;
  if (typeof val === 'number') return isFinite(val) ? val : null;
  const cleaned = String(val)
    .replace(/(?:Rs\.?|PKR)\s*/gi, '')
    .replace(/,/g, '')
    .trim();
  const num = parseFloat(cleaned);
  return isFinite(num) ? num : null;
}

/**
 * Parses date strings into standard PKT date and datetime format.
 */
function parseDateTime(rawDateStr) {
  if (!rawDateStr || typeof rawDateStr !== 'string') {
    return { date: '', time: '', datetimeIso: '' };
  }
  const clean = rawDateStr.trim().replace(/\bat\b/gi, ' ').replace(/\s+/g, ' ');

  // Pattern 1: 13-Oct-2026 or 13-October-2026 or 13 Oct 2026 [14:20:38]
  const patternWordMonth = /^(\d{1,2})[-/ ]([A-Za-z]{3,9})[-/ ](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/;
  const m1 = clean.match(patternWordMonth);
  if (m1) {
    const day = m1[1].padStart(2, '0');
    const monthKey = m1[2].toLowerCase();
    const month = MONTH_MAP[monthKey] || '01';
    const year = m1[3];
    const hour = (m1[4] || '00').padStart(2, '0');
    const min = (m1[5] || '00').padStart(2, '0');
    const sec = (m1[6] || '00').padStart(2, '0');
    const date = year + '-' + month + '-' + day;
    const time = hour + ':' + min + ':' + sec;
    return { date: date, time: time, datetimeIso: date + 'T' + time + '+05:00' };
  }

  // Pattern 2: ISO YYYY-MM-DD
  const patternIso = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/;
  const m2 = clean.match(patternIso);
  if (m2) {
    const year = m2[1];
    const month = m2[2].padStart(2, '0');
    const day = m2[3].padStart(2, '0');
    const hour = (m2[4] || '00').padStart(2, '0');
    const min = (m2[5] || '00').padStart(2, '0');
    const sec = (m2[6] || '00').padStart(2, '0');
    const date = year + '-' + month + '-' + day;
    const time = hour + ':' + min + ':' + sec;
    return { date: date, time: time, datetimeIso: date + 'T' + time + '+05:00' };
  }

  return { date: '', time: '', datetimeIso: '' };
}

/**
 * Resolves Sent vs Received direction based on sender, receiver, and owner phone.
 */
function resolveTxnDirection(senderNum, receiverNum, defaultDir, ownerNum) {
  const normOwner = normalizePhone(ownerNum);
  const normSender = normalizePhone(senderNum);
  const normReceiver = normalizePhone(receiverNum);

  if (normOwner) {
    if (normSender && normSender === normOwner) return 'Sent';
    if (normReceiver && normReceiver === normOwner) return 'Received';
  }

  if (defaultDir === 'Sent' || defaultDir === 'Received') {
    return defaultDir;
  }
  return 'Unknown';
}

/**
 * Parses email or message plain text into a structured transaction object.
 */
function parseEasypaisaEmailText(rawText, options) {
  options = options || {};
  if (!rawText || typeof rawText !== 'string' || !rawText.trim()) {
    return {
      status: 'Needs review',
      notes: 'Empty or blank message body',
      txnId: '',
      direction: 'Unknown',
      amount: null
    };
  }

  // Clean HTML if present
  const clean = rawText
    .replace(/<\/(?:tr|div|p|li)>/gi, '\n')
    .replace(/<(?:br|\/td)\s*\/?>/gi, '\t')
    .replace(/<[^>]+>/g, ' ');

  // 1. Template: Key-Value Email
  const lower = clean.toLowerCase();
  if (lower.includes('transaction id') || lower.includes('trx id') || lower.includes('money transfer to easypaisa')) {
    const lines = clean.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const kv = {};

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      let key = '';
      let val = '';

      if (line.includes('\t')) {
        const parts = line.split('\t');
        key = parts[0].trim();
        val = parts.slice(1).join('\t').trim();
      } else if (line.includes(':')) {
        const colonIdx = line.indexOf(':');
        key = line.slice(0, colonIdx).trim();
        val = line.slice(colonIdx + 1).trim();
      } else if (/\s{2,}/.test(line)) {
        const parts = line.split(/\s{2,}/);
        key = parts[0].trim();
        val = parts.slice(1).join(' ').trim();
      } else if (i + 1 < lines.length) {
        const testKey = line.toLowerCase().replace(/[^a-z0-9]/g, '');
        const recognized = [
          'transactiontype', 'type', 'transactionid', 'trxid', 'datetime', 'dateandtime',
          'sendername', 'sendernumber', 'receivername', 'receivernumber', 'transferamount',
          'amount', 'fee', 'total'
        ];
        if (recognized.includes(testKey)) {
          key = line;
          val = lines[i + 1].trim();
          i++;
        }
      }

      if (key) {
        const normKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (val) kv[normKey] = val;
      }
    }

    const txnId = kv['transactionid'] || kv['trxid'] || kv['txnid'] || '';
    const rawType = kv['transactiontype'] || kv['type'] || 'Money Transfer to Easypaisa';
    const rawDt = kv['datetime'] || kv['dateandtime'] || kv['date'] || '';
    const parsedDt = parseDateTime(rawDt);

    const senderName = kv['sendername'] || '';
    const senderNumber = normalizePhone(kv['sendernumber'] || kv['senderaccount'] || '');
    const receiverName = kv['receivername'] || '';
    const receiverNumber = normalizePhone(kv['receivernumber'] || kv['receiveraccount'] || '');

    const rawAmount = kv['transferamount'] || kv['amount'];
    const amount = parseAmount(rawAmount);

    const rawFee = kv['fee'] || kv['charges'];
    const fee = parseAmount(rawFee) !== null ? parseAmount(rawFee) : 0;

    let total = parseAmount(kv['total']);
    if (total === null && amount !== null) {
      total = amount + fee;
    }

    if (txnId && amount !== null) {
      let defaultDir = 'Unknown';
      if (/transfer to|sent/i.test(rawType) || /transfer.*to easypaisa was successful/i.test(clean)) {
        defaultDir = 'Sent';
      } else if (/received|transfer from/i.test(rawType) || /received.*from/i.test(clean)) {
        defaultDir = 'Received';
      }

      const direction = resolveTxnDirection(senderNumber, receiverNumber, defaultDir, options.ownerNumber);

      return {
        status: 'Parsed',
        txnId: txnId,
        type: rawType,
        datetime: rawDt,
        date: parsedDt.date,
        amount: amount,
        fee: fee,
        total: total,
        senderName: senderName,
        senderNumber: senderNumber,
        receiverName: receiverName,
        receiverNumber: receiverNumber,
        direction: direction,
        notes: 'Parsed via Key-Value template'
      };
    }
  }

  // 2. Template: SMS Received Format
  const rxSms = /received\s+(?:rs\.?|pkr)?\s*([\d,.]+)\s+from\s+(.*?)\s*\((03\d{9})\)/i;
  const matchSms = clean.match(rxSms);
  const txnMatch = clean.match(/(?:trx\s*id|transaction\s*id|txnid)\s*[:\s]\s*(\w+)/i);

  if (matchSms && txnMatch) {
    const amount = parseAmount(matchSms[1]);
    const txnId = txnMatch[1].trim();
    const senderName = matchSms[2].trim();
    const senderNumber = normalizePhone(matchSms[3]);

    const dtMatch = clean.match(/on\s+(\d{1,2}[-/ ][A-Za-z0-9]{3,9}[-/ ]\d{4}(?:\s+(?:at\s+)?\d{1,2}:\d{2}(?::\d{2})?)?)/i);
    const rawDt = dtMatch ? dtMatch[1].trim() : '';
    const parsedDt = parseDateTime(rawDt);

    const direction = resolveTxnDirection(senderNumber, '', 'Received', options.ownerNumber);

    return {
      status: 'Parsed',
      txnId: txnId,
      type: 'Received Money from Easypaisa',
      datetime: rawDt,
      date: parsedDt.date,
      amount: amount,
      fee: 0,
      total: amount,
      senderName: senderName,
      senderNumber: senderNumber,
      receiverName: '',
      receiverNumber: normalizePhone(options.ownerNumber || ''),
      direction: direction,
      notes: 'Parsed via SMS template'
    };
  }

  // Fallback: Needs review
  return {
    status: 'Needs review',
    txnId: '',
    type: 'Unknown',
    datetime: options.dateFallback ? new Date(options.dateFallback).toISOString() : '',
    date: options.dateFallback ? new Date(options.dateFallback).toISOString().slice(0, 10) : '',
    amount: null,
    fee: 0,
    total: null,
    senderName: '',
    senderNumber: '',
    receiverName: '',
    receiverNumber: '',
    direction: 'Unknown',
    notes: 'Unrecognized format. Subject: ' + (options.subject || 'N/A')
  };
}

// ============================================================================
// COMMONJS EXPORTS (For local unit testing in Node environment)
// ============================================================================
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    CONFIG: CONFIG,
    HEADERS: HEADERS,
    normalizePhone: normalizePhone,
    parseAmount: parseAmount,
    parseDateTime: parseDateTime,
    resolveTxnDirection: resolveTxnDirection,
    parseEasypaisaEmailText: parseEasypaisaEmailText,
    buildRowFromTxn: buildRowFromTxn
  };
}
