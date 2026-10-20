/**
 * easypaisa-parser.js - Easypaisa Email, SMS, and Statement Parser (#305).
 *
 * Pure JS parser with table-driven templates for Easypaisa notifications.
 * Extracts fields: type, txnId, datetime, datetimeIso, date, senderName, senderNumber,
 * receiverName, receiverNumber, amount, fee, total, direction ('Sent' | 'Received' | 'Unknown').
 * Unparsed or invalid inputs are flagged as 'Needs review' instead of throwing or dropping.
 *
 * Part of GitHub Issue #305 (OfferPk/shahdara-isp-billing).
 */

const MONTH_NAMES = {
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
 * Normalizes Pakistani mobile phone numbers into standard 11-digit local format: 03XXXXXXXXX.
 * Strips formatting, handles +92 / 92 country codes, and Arabic/Urdu numerals.
 */
export function normalizeEasypaisaPhone(value) {
  if (!value) return '';
  const str = String(value)
    .normalize('NFKC')
    .replace(/[٠-٩۰-۹]/g, digit => {
      const code = digit.codePointAt(0);
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
 * Parses numeric currency amount from formatted strings (e.g. "Rs. 5000.0", "PKR 12,500.50", "5000").
 * Returns a finite number or null if invalid.
 */
export function parseEasypaisaAmount(val) {
  if (val === null || val === undefined || val === '') return null;
  if (typeof val === 'number') return Number.isFinite(val) ? val : null;
  const cleaned = String(val)
    .replace(/(?:Rs\.?|PKR)\s*/gi, '')
    .replace(/,/g, '')
    .trim();
  const num = parseFloat(cleaned);
  return Number.isFinite(num) ? num : null;
}

/**
 * Normalizes dates from Easypaisa notifications (e.g. "13-Oct-2026 14:20:38" or "13-10-2026")
 * into standard PKT representations:
 * - date: 'YYYY-MM-DD'
 * - time: 'HH:mm:ss'
 * - datetimeIso: 'YYYY-MM-DDTHH:mm:ss+05:00'
 */
export function parsePakistanDateTime(rawDateStr) {
  if (!rawDateStr || typeof rawDateStr !== 'string') {
    return { date: '', time: '', datetimeIso: '' };
  }
  const clean = rawDateStr.trim().replace(/\bat\b/gi, ' ').replace(/\s+/g, ' ');

  // Pattern 1: 13-Oct-2026 or 13-October-2026 or 13 Oct 2026 [14:20:38]
  const patternWordMonth = /^(\d{1,2})[-/ ]([A-Za-z]{3,9})[-/ ](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/;
  const match1 = clean.match(patternWordMonth);
  if (match1) {
    const day = match1[1].padStart(2, '0');
    const monthKey = match1[2].toLowerCase();
    const month = MONTH_NAMES[monthKey] || '01';
    const year = match1[3];
    const hour = (match1[4] || '00').padStart(2, '0');
    const min = (match1[5] || '00').padStart(2, '0');
    const sec = (match1[6] || '00').padStart(2, '0');
    const date = `${year}-${month}-${day}`;
    const time = `${hour}:${min}:${sec}`;
    return { date, time, datetimeIso: `${date}T${time}+05:00` };
  }

  // Pattern 2: 2026-10-13 or 2026/10/13 [14:20:38]
  const patternIso = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/;
  const match2 = clean.match(patternIso);
  if (match2) {
    const year = match2[1];
    const month = match2[2].padStart(2, '0');
    const day = match2[3].padStart(2, '0');
    const hour = (match2[4] || '00').padStart(2, '0');
    const min = (match2[5] || '00').padStart(2, '0');
    const sec = (match2[6] || '00').padStart(2, '0');
    const date = `${year}-${month}-${day}`;
    const time = `${hour}:${min}:${sec}`;
    return { date, time, datetimeIso: `${date}T${time}+05:00` };
  }

  // Pattern 3: 13-10-2026 or 13/10/2026 [14:20:38]
  const patternNumeric = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/;
  const match3 = clean.match(patternNumeric);
  if (match3) {
    const day = match3[1].padStart(2, '0');
    const month = match3[2].padStart(2, '0');
    const year = match3[3];
    const hour = (match3[4] || '00').padStart(2, '0');
    const min = (match3[5] || '00').padStart(2, '0');
    const sec = (match3[6] || '00').padStart(2, '0');
    const date = `${year}-${month}-${day}`;
    const time = `${hour}:${min}:${sec}`;
    return { date, time, datetimeIso: `${date}T${time}+05:00` };
  }

  return { date: '', time: '', datetimeIso: '' };
}

/**
 * Helper to determine Sent vs Received direction based on sender/receiver and owner phone number.
 */
function resolveDirection(senderNum, receiverNum, defaultDirection, ownerNumber) {
  const normOwner = normalizeEasypaisaPhone(ownerNumber);
  const normSender = normalizeEasypaisaPhone(senderNum);
  const normReceiver = normalizeEasypaisaPhone(receiverNum);

  if (normOwner) {
    if (normSender && normSender === normOwner) return 'Sent';
    if (normReceiver && normReceiver === normOwner) return 'Received';
  }

  if (defaultDirection === 'Sent' || defaultDirection === 'Received') {
    return defaultDirection;
  }
  return 'Unknown';
}

/**
 * Standard Key-Value Email Template.
 * Matches official Easypaisa transaction emails formatted as key-value pairs
 * separated by tabs (\t), colons (:), multiple spaces, or newlines.
 */
const KeyValueTemplate = {
  name: 'easypaisa_key_value_email',
  matches(text) {
    if (!text || typeof text !== 'string') return false;
    const lower = text.toLowerCase();
    const hasTxn = lower.includes('transaction id') || lower.includes('trx id') || lower.includes('transaction #');
    const hasEasypaisa = lower.includes('easypaisa') || lower.includes('money transfer') || lower.includes('transaction successful');
    return hasTxn && hasEasypaisa;
  },
  extract(rawText, options = {}) {
    // Strip HTML markup if present
    const cleanText = rawText
      .replace(/<\/(?:tr|div|p|li)>/gi, '\n')
      .replace(/<(?:br|\/td)\s*\/?>/gi, '\t')
      .replace(/<[^>]+>/g, ' ');

    const lines = cleanText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
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
        // Check if current line is a known label without value on the same line
        const testKey = line.toLowerCase().replace(/[^a-z0-9]/g, '');
        const recognizedKeys = [
          'transactiontype', 'type', 'transactionid', 'trxid', 'datetime', 'dateandtime',
          'sendername', 'sendernumber', 'receivername', 'receivernumber', 'recipientname',
          'recipientnumber', 'transferamount', 'amount', 'fee', 'total'
        ];
        if (recognizedKeys.includes(testKey)) {
          key = line;
          val = lines[i + 1].trim();
          i++; // skip next line since consumed
        }
      }

      if (key) {
        const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (val) kv[normalizedKey] = val;
      }
    }

    // Extract core fields
    const txnId = kv['transactionid'] || kv['trxid'] || kv['transactionno'] || kv['txnid'] || '';
    if (!txnId) return null;

    const rawType = kv['transactiontype'] || kv['type'] || 'Money Transfer to Easypaisa';
    const rawDatetime = kv['datetime'] || kv['dateandtime'] || kv['date'] || '';
    const parsedDt = parsePakistanDateTime(rawDatetime);

    const senderName = kv['sendername'] || kv['sender'] || '';
    const senderNumber = normalizeEasypaisaPhone(kv['sendernumber'] || kv['sendermobile'] || kv['senderaccount'] || '');
    const receiverName = kv['receivername'] || kv['recipientname'] || kv['receiver'] || '';
    const receiverNumber = normalizeEasypaisaPhone(kv['receivernumber'] || kv['recipientnumber'] || kv['receivermobile'] || kv['receiveraccount'] || '');

    const rawAmount = kv['transferamount'] || kv['amount'];
    let amount = parseEasypaisaAmount(rawAmount);

    const rawFee = kv['fee'] || kv['charges'] || kv['servicefee'];
    const fee = parseEasypaisaAmount(rawFee) ?? 0;

    let total = parseEasypaisaAmount(kv['total'] || kv['totalamount']);
    if (total === null && amount !== null) {
      total = amount + fee;
    }
    if (amount === null && total !== null) {
      amount = total - fee;
    }

    if (amount === null || !Number.isFinite(amount)) {
      return null;
    }

    // Default direction inferred from text if ownerNumber not matching
    let defaultDir = 'Unknown';
    if (/transfer to|sent/i.test(rawType) || /transfer.*to easypaisa was successful/i.test(rawText)) {
      defaultDir = 'Sent';
    } else if (/received|transfer from/i.test(rawType) || /received.*from/i.test(rawText)) {
      defaultDir = 'Received';
    }

    const direction = resolveDirection(senderNumber, receiverNumber, defaultDir, options.ownerNumber);

    return {
      status: 'Parsed',
      parsed: true,
      template: this.name,
      type: rawType,
      txnId,
      datetime: rawDatetime,
      datetimeIso: parsedDt.datetimeIso,
      date: parsedDt.date,
      senderName,
      senderNumber,
      receiverName,
      receiverNumber,
      amount,
      fee,
      total,
      direction,
      rawText
    };
  }
};

/**
 * Easypaisa SMS Notification Template.
 * Example: "You have received Rs. 2000.00 from JOHN DOE (03001234567) in your Easypaisa Account. Trx ID: 57255283609 on 13-Oct-2026 15:30:00"
 */
const SmsReceivedTemplate = {
  name: 'easypaisa_sms_received',
  matches(text) {
    if (!text || typeof text !== 'string') return false;
    const lower = text.toLowerCase();
    return (lower.includes('received rs') || lower.includes('received pkr')) &&
      (lower.includes('trx id') || lower.includes('transaction id'));
  },
  extract(rawText, options = {}) {
    const rx = /received\s+(?:rs\.?|pkr)?\s*([\d,.]+)\s+from\s+(.*?)\s*\((03\d{9})\)/i;
    const match = rawText.match(rx);
    const txnMatch = rawText.match(/(?:trx\s*id|transaction\s*id|txnid)\s*[:\s]\s*(\w+)/i);

    if (!match && !txnMatch) return null;

    const amount = match ? parseEasypaisaAmount(match[1]) : parseEasypaisaAmount(rawText.match(/rs\.?\s*([\d,.]+)/i)?.[1]);
    const txnId = txnMatch ? txnMatch[1].trim() : '';
    if (!txnId || amount === null) return null;

    const senderName = match ? match[2].trim() : '';
    const senderNumber = match ? normalizeEasypaisaPhone(match[3]) : '';

    const dtMatch = rawText.match(/on\s+(\d{1,2}[-/ ][A-Za-z0-9]{3,9}[-/ ]\d{4}(?:\s+(?:at\s+)?\d{1,2}:\d{2}(?::\d{2})?)?)/i);
    const rawDatetime = dtMatch ? dtMatch[1].trim() : '';
    const parsedDt = parsePakistanDateTime(rawDatetime);

    const fee = 0;
    const total = amount;
    const direction = resolveDirection(senderNumber, '', 'Received', options.ownerNumber);

    return {
      status: 'Parsed',
      parsed: true,
      template: this.name,
      type: 'Received Money from Easypaisa',
      txnId,
      datetime: rawDatetime,
      datetimeIso: parsedDt.datetimeIso,
      date: parsedDt.date,
      senderName,
      senderNumber,
      receiverName: '',
      receiverNumber: normalizeEasypaisaPhone(options.ownerNumber || ''),
      amount,
      fee,
      total,
      direction,
      rawText
    };
  }
};

/**
 * Statement CSV / Tabular Row Template.
 * Example row: "57255283608, 13-Oct-2026 14:20:38, Money Transfer, 03055669955, 03335001667, 5000, 0, 5000"
 */
const CsvRowTemplate = {
  name: 'easypaisa_csv_row',
  matches(text) {
    if (!text || typeof text !== 'string') return false;
    return text.includes(',') && /\b\d{10,12}\b/.test(text);
  },
  extract(rawText, options = {}) {
    const cols = rawText.split(',').map(c => c.trim().replace(/^["']|["']$/g, ''));
    if (cols.length < 5) return null;

    // Search for a column that looks like a transaction ID (10-12 digits)
    const txnIdx = cols.findIndex(c => /^\d{10,12}$/.test(c));
    if (txnIdx === -1) return null;

    const txnId = cols[txnIdx];
    const rawDatetime = cols.find(c => parsePakistanDateTime(c).date !== '') || '';
    const parsedDt = parsePakistanDateTime(rawDatetime);

    // Look for amounts
    const numericCols = cols
      .map((c, i) => ({ idx: i, val: parseEasypaisaAmount(c) }))
      .filter(item => item.idx !== txnIdx && item.val !== null && item.val > 0);

    if (!numericCols.length) return null;
    const amount = numericCols[0].val;
    const fee = numericCols.length > 2 ? numericCols[1].val : 0;
    const total = numericCols.length > 2 ? numericCols[2].val : (amount + fee);

    // Look for phone numbers
    const phones = cols.map(c => normalizeEasypaisaPhone(c)).filter(p => /^03\d{9}$/.test(p));
    const senderNumber = phones[0] || '';
    const receiverNumber = phones[1] || '';

    const direction = resolveDirection(senderNumber, receiverNumber, 'Unknown', options.ownerNumber);

    return {
      status: 'Parsed',
      parsed: true,
      template: this.name,
      type: 'Easypaisa Statement Transaction',
      txnId,
      datetime: rawDatetime,
      datetimeIso: parsedDt.datetimeIso,
      date: parsedDt.date,
      senderName: '',
      senderNumber,
      receiverName: '',
      receiverNumber,
      amount,
      fee,
      total,
      direction,
      rawText
    };
  }
};

/**
 * Table of registered templates in priority order.
 */
export const TEMPLATES = [
  KeyValueTemplate,
  SmsReceivedTemplate,
  CsvRowTemplate
];

/**
 * Main entry point: Parses a single Easypaisa email, SMS, or text notification.
 *
 * @param {string} rawText The raw text of the email or message.
 * @param {Object} [options]
 * @param {string} [options.ownerNumber] Owner's Easypaisa mobile number to resolve Sent vs Received direction.
 * @returns {Object} Parsed transaction object with status 'Parsed' or 'Needs review'.
 */
export function parseEasypaisaEmail(rawText, options = {}) {
  if (!rawText || typeof rawText !== 'string' || !rawText.trim()) {
    return {
      status: 'Needs review',
      parsed: false,
      reason: 'Empty or invalid email text',
      type: 'Unknown',
      txnId: '',
      datetime: '',
      datetimeIso: '',
      date: '',
      senderName: '',
      senderNumber: '',
      receiverName: '',
      receiverNumber: '',
      amount: null,
      fee: 0,
      total: null,
      direction: 'Unknown',
      rawText: rawText || ''
    };
  }

  for (const template of TEMPLATES) {
    if (template.matches(rawText)) {
      try {
        const result = template.extract(rawText, options);
        if (result && result.txnId && result.amount !== null) {
          return result;
        }
      } catch {
        // Continue to next template if an error occurred during extraction
      }
    }
  }

  // Fallback: If no template produced a complete record, flag as Needs review
  return {
    status: 'Needs review',
    parsed: false,
    reason: 'Unrecognized transaction format or missing required transaction ID/amount',
    type: 'Unknown',
    txnId: '',
    datetime: '',
    datetimeIso: '',
    date: '',
    senderName: '',
    senderNumber: '',
    receiverName: '',
    receiverNumber: '',
    amount: null,
    fee: 0,
    total: null,
    direction: 'Unknown',
    rawText
  };
}

/**
 * Parses multiple emails or messages (array of strings, or text with multiple records).
 *
 * @param {string[]|string} input An array of email strings or a single multi-record text.
 * @param {Object} [options]
 * @returns {Object[]} Array of parsed transaction objects.
 */
export function parseEasypaisaEmails(input, options = {}) {
  if (!input) return [];
  if (Array.isArray(input)) {
    return input.map(item => parseEasypaisaEmail(item, options));
  }

  if (typeof input === 'string') {
    // If separated by standard Easypaisa delimiter or Transaction Successful headers
    const chunks = input.split(/(?=Transaction Successful|You have received Rs)/i).map(c => c.trim()).filter(Boolean);
    if (chunks.length > 1) {
      return chunks.map(chunk => parseEasypaisaEmail(chunk, options));
    }
    return [parseEasypaisaEmail(input, options)];
  }

  return [];
}

/**
 * Parses a single CSV line into an array of cell values according to RFC-4180 rules
 * (supports double quotes, escaped quotes, and commas inside quotes).
 *
 * @param {string} line
 * @returns {string[]}
 */
export function parseCsvLine(line) {
  if (line === null || line === undefined) return [];
  const str = String(line);
  const result = [];
  let cur = '';
  let inQuotes = false;

  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (ch === '"') {
      if (inQuotes && str[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  result.push(cur.trim());
  return result;
}

/**
 * Parses full CSV content (from Google Sheets publish, CSV export, or tabular text).
 * Automatically detects column headers or falls back to column order.
 *
 * @param {string} csvText
 * @param {Object} [options]
 * @param {string} [options.ownerNumber]
 * @returns {Object[]} Array of parsed transaction objects.
 */
export function parseEasypaisaCsv(csvText, options = {}) {
  if (!csvText || typeof csvText !== 'string') return [];
  const rawLines = csvText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const lines = rawLines.map(l => l.trim()).filter(Boolean);
  if (!lines.length) return [];

  // Determine headers
  const firstRow = parseCsvLine(lines[0]);
  const normHeaders = firstRow.map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ''));

  const findCol = (...candidates) => {
    for (const cand of candidates) {
      const idx = normHeaders.indexOf(cand);
      if (idx !== -1) return idx;
    }
    return -1;
  };

  const txnCol = findCol('transactionid', 'txnid', 'trxid', 'transaction', 'ref', 'reference');
  const dateCol = findCol('datetimepkt', 'datetime', 'dateandtime', 'date', 'time');
  const typeCol = findCol('transactiontype', 'type');
  const senderNameCol = findCol('sendername', 'sender');
  const senderNumberCol = findCol('sendernumber', 'sendermobile', 'senderphone');
  const receiverNameCol = findCol('receivername', 'receiver', 'recipientname');
  const receiverNumberCol = findCol('receivernumber', 'receivermobile', 'receiverphone', 'recipientnumber');
  const amountCol = findCol('amountpkr', 'amount', 'transferamount');
  const feeCol = findCol('feepkr', 'fee');
  const totalCol = findCol('totalpkr', 'total');
  const directionCol = findCol('direction');
  const statusCol = findCol('status');

  const hasHeaders = txnCol !== -1 || dateCol !== -1 || amountCol !== -1;
  const startIdx = hasHeaders ? 1 : 0;
  const results = [];

  for (let i = startIdx; i < lines.length; i++) {
    const row = parseCsvLine(lines[i]);
    if (!row.length || (row.length === 1 && !row[0])) continue;

    // If single column containing full message text, run standard parser
    if (row.length === 1 && row[0].length > 40) {
      results.push(parseEasypaisaEmail(row[0], options));
      continue;
    }

    const txnId = txnCol !== -1 && row[txnCol] ? row[txnCol] : (row[0] || `EP-CSV-${Date.now()}-${i}`);
    const rawDate = dateCol !== -1 && row[dateCol] ? row[dateCol] : (row[1] || '');
    const type = typeCol !== -1 && row[typeCol] ? row[typeCol] : (row[2] || 'Money Transfer to Easypaisa');
    const senderName = senderNameCol !== -1 && row[senderNameCol] ? row[senderNameCol] : (row[3] || '');
    const senderNumber = normalizeEasypaisaPhone(senderNumberCol !== -1 && row[senderNumberCol] ? row[senderNumberCol] : (row[4] || ''));
    const receiverName = receiverNameCol !== -1 && row[receiverNameCol] ? row[receiverNameCol] : (row[5] || '');
    const receiverNumber = normalizeEasypaisaPhone(receiverNumberCol !== -1 && row[receiverNumberCol] ? row[receiverNumberCol] : (row[6] || ''));
    const rawAmount = amountCol !== -1 && row[amountCol] ? row[amountCol] : (row[7] || '');
    const rawFee = feeCol !== -1 && row[feeCol] ? row[feeCol] : (row[8] || '0');
    const rawTotal = totalCol !== -1 && row[totalCol] ? row[totalCol] : (row[9] || '');
    const rawDirection = directionCol !== -1 && row[directionCol] ? row[directionCol] : (row[10] || '');
    const rawStatus = statusCol !== -1 && row[statusCol] ? row[statusCol] : '';

    const amount = parseEasypaisaAmount(rawAmount);
    const fee = parseEasypaisaAmount(rawFee) ?? 0;
    const total = parseEasypaisaAmount(rawTotal) ?? ((amount !== null ? amount : 0) + fee);
    const parsedDt = parsePakistanDateTime(rawDate);

    let direction = 'Unknown';
    if (/^sent$/i.test(rawDirection)) direction = 'Sent';
    else if (/^received$/i.test(rawDirection)) direction = 'Received';
    else direction = resolveDirection(senderNumber, receiverNumber, 'Unknown', options.ownerNumber);

    const isParsed = amount !== null && amount > 0 && Boolean(txnId) && !txnId.startsWith('REVIEW-');
    const status = rawStatus || (isParsed ? 'Parsed' : 'Needs review');

    results.push({
      status,
      parsed: status === 'Parsed',
      template: 'easypaisa_csv_row',
      type,
      txnId,
      datetime: rawDate,
      datetimeIso: parsedDt.datetimeIso,
      date: parsedDt.date,
      senderName,
      senderNumber,
      receiverName,
      receiverNumber,
      amount,
      fee,
      total,
      direction,
      rawText: lines[i]
    });
  }

  return results;
}

// Global browser window export when loaded as standard script tag
if (typeof window !== 'undefined') {
  window.easypaisaParser = {
    parseEasypaisaEmail,
    parseEasypaisaEmails,
    parseEasypaisaCsv,
    parseCsvLine,
    normalizeEasypaisaPhone,
    parseEasypaisaAmount,
    parsePakistanDateTime,
    TEMPLATES
  };
}
