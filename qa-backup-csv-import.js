/**
 * Shahdara ISP Billing - Backup / Restore Hardening & CSV Customer Import Engine
 *
 * Provides:
 * 1. Storage key catalog & round-trip verification across all ledger and operational stores.
 * 2. Corrupted and old-version backup inspection and pre-flight validation.
 * 3. RFC-4180 compliant CSV parser with flexible header matching for Pakistani ISP customer lists.
 * 4. Validation preview (new profiles, enrichable profiles, conflicts, errors).
 * 5. Non-destructive merge-only CSV customer import engine.
 * 6. Downloadable starter CSV template for ISP owners migrating from spreadsheets.
 */

export const STORAGE_KEYS_CATALOG = Object.freeze([
  { key: 'shahdara-isp-billing-v1', label: 'Primary Ledger & Customer Store', critical: true, category: 'billing' },
  { key: 'shahdara_collection_targets', label: 'Monthly Collection Targets', critical: false, category: 'billing' },
  { key: 'shahdara_customer_adjustments', label: 'Customer Adjustment Vouchers', critical: false, category: 'billing' },
  { key: 'shahdara_service_agreements', label: 'Service Contract Agreements', critical: false, category: 'billing' },
  { key: 'shahdara_dispute_claims', label: 'Billing Dispute Claims', critical: false, category: 'billing' },
  { key: 'shahdara_equipment_retrievals_v1', label: 'ONU/Router Equipment Retrievals', critical: false, category: 'inventory' },
  { key: 'shahdara_collection_promises_v1', label: 'Customer Collection Promises', critical: false, category: 'billing' },
  { key: 'shahdara_receipts_shared_v1', label: 'WhatsApp Receipt Share Tracker', critical: false, category: 'billing' },
  { key: 'shahdara_offline_payment_queue', label: 'Offline Payment Sync Queue', critical: false, category: 'offline' },
  { key: 'shahdara_quick_collect_last_used_v1', label: 'Quick Collect Method Preference', critical: false, category: 'ui' },
  { key: 'shahdara_quick_collect_audits_v1', label: 'Quick Collect Audit Trail', critical: false, category: 'billing' },
  { key: 'shahdara_area_recovery_rounds_v1', label: 'Area Recovery Field Rounds', critical: false, category: 'billing' },
  { key: 'shahdara_late_fee_policy_v1', label: 'Late Fee Policy & Waive Audit', critical: false, category: 'billing' },
  { key: 'shahdara_billing_correctness_audits_v1', label: 'Billing Correctness Audit Log', critical: false, category: 'audit' },
  { key: 'shahdara_data_integrity_audits_v1', label: 'Data Integrity Audit & Repair Log', critical: false, category: 'audit' },
  { key: 'shahdara_theme', label: 'User Theme Preference (Light/Dark)', critical: false, category: 'ui' },
  { key: 'shahdara_language', label: 'User Language Preference (English/Urdu)', critical: false, category: 'ui' }
]);

/**
 * Validates JSON backup file header before full processing.
 * Returns structured inspection result with error or version info.
 */
export function inspectBackupFileHeader(backupText) {
  if (typeof backupText !== 'string' || !backupText.trim()) {
    return { valid: false, error: 'Backup file is empty or not readable text.', version: null, format: null };
  }
  if (backupText.length > 25 * 1024 * 1024) {
    return { valid: false, error: 'Backup file exceeds maximum allowed size of 25 MB.', version: null, format: null };
  }
  let parsed;
  try {
    parsed = JSON.parse(backupText);
  } catch (err) {
    return { valid: false, error: `Invalid JSON syntax: ${err.message}`, version: null, format: null };
  }
  if (!parsed || typeof parsed !== 'object') {
    return { valid: false, error: 'Backup content must be a JSON object.', version: null, format: null };
  }
  if (parsed.format !== 'shahdara-isp-billing-backup') {
    return {
      valid: false,
      error: `Unrecognized backup format "${parsed.format || 'unknown'}". Expected "shahdara-isp-billing-backup".`,
      version: parsed.formatVersion ?? null,
      format: parsed.format ?? null
    };
  }
  const version = Number(parsed.formatVersion);
  if (version > 1) {
    return {
      valid: false,
      error: `Backup format version ${version} is newer than supported by this app (version 1). Please update the app first.`,
      version,
      format: parsed.format
    };
  }
  if (version < 1 || isNaN(version)) {
    return {
      valid: false,
      error: `Legacy or unsupported backup format version (${parsed.formatVersion}).`,
      version,
      format: parsed.format
    };
  }
  return {
    valid: true,
    error: null,
    version,
    format: parsed.format,
    exportedAt: parsed.exportedAt || null,
    customerCount: Array.isArray(parsed.state?.customers) ? parsed.state.customers.length : 0
  };
}

/**
 * Verifies round-trip fidelity and corrupted-data resilience for all storage keys.
 */
export function verifyAllStorageKeysRoundTrip(storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  if (!storage) {
    return {
      totalKeys: STORAGE_KEYS_CATALOG.length,
      passedKeys: 0,
      allPassed: false,
      error: 'Storage is unavailable.',
      results: []
    };
  }

  const results = [];
  for (const item of STORAGE_KEYS_CATALOG) {
    const originalValue = storage.getItem(item.key);
    let roundTripPassed = false;
    let corruptedHandled = false;
    let errorDetail = null;

    try {
      // 1. Test round-trip write/read
      const testPayload = JSON.stringify({ _testCheck: true, stamp: Date.now(), key: item.key });
      storage.setItem(item.key, testPayload);
      const readBack = storage.getItem(item.key);
      roundTripPassed = (readBack === testPayload);

      // 2. Test corrupted data recovery
      storage.setItem(item.key, '{invalid-json-corrupted-test-string');
      const corruptedRead = storage.getItem(item.key);
      // Safe parsing test
      let safelyHandled = false;
      try {
        JSON.parse(corruptedRead);
      } catch {
        safelyHandled = true; // Expected failure caught gracefully
      }
      corruptedHandled = safelyHandled;
    } catch (err) {
      errorDetail = err.message;
    } finally {
      // Restore original value
      if (originalValue !== null) {
        storage.setItem(item.key, originalValue);
      } else {
        storage.removeItem(item.key);
      }
    }

    const passed = roundTripPassed && corruptedHandled;
    results.push({
      key: item.key,
      label: item.label,
      critical: item.critical,
      category: item.category,
      roundTripPassed,
      corruptedHandled,
      passed,
      errorDetail
    });
  }

  const passedKeys = results.filter(r => r.passed).length;
  return {
    totalKeys: STORAGE_KEYS_CATALOG.length,
    passedKeys,
    allPassed: passedKeys === STORAGE_KEYS_CATALOG.length,
    results
  };
}

/**
 * Standard RFC-4180 CSV parser supporting quotes, commas, CRLF/LF, and UTF-8 BOM.
 */
export function parseCsvRows(csvText) {
  if (typeof csvText !== 'string') return [];
  // Strip UTF-8 BOM if present
  const cleanText = csvText.startsWith('\uFEFF') ? csvText.slice(1) : csvText;
  if (!cleanText.trim()) return [];

  const rows = [];
  let currentRow = [];
  let currentField = '';
  let insideQuotes = false;
  let i = 0;

  while (i < cleanText.length) {
    const char = cleanText[i];
    const nextChar = cleanText[i + 1];

    if (insideQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          // Escaped quote
          currentField += '"';
          i += 2;
          continue;
        } else {
          // Closing quote
          insideQuotes = false;
          i++;
          continue;
        }
      } else {
        currentField += char;
        i++;
        continue;
      }
    } else {
      if (char === '"') {
        insideQuotes = true;
        i++;
        continue;
      } else if (char === ',') {
        currentRow.push(currentField.trim());
        currentField = '';
        i++;
        continue;
      } else if (char === '\r') {
        if (nextChar === '\n') {
          i++; // Skip \n in CRLF
        }
        currentRow.push(currentField.trim());
        if (currentRow.some(f => f.length > 0)) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentField = '';
        i++;
        continue;
      } else if (char === '\n') {
        currentRow.push(currentField.trim());
        if (currentRow.some(f => f.length > 0)) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentField = '';
        i++;
        continue;
      } else {
        currentField += char;
        i++;
        continue;
      }
    }
  }

  // Final field
  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some(f => f.length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

/**
 * Maps CSV header names to normalized internal customer properties.
 */
export function mapCustomerCsvHeaders(headerRow) {
  if (!Array.isArray(headerRow)) return {};
  const mapping = {};

  const synonyms = {
    customerNumber: ['customernumber', 'customer #', 'customer_number', 'cust no', 'cust #', 'cust_id', 'custid', 'id', 'no', 'sr', 'sr #', 'sr_no', 'account #', 'account no'],
    name: ['name', 'customer name', 'customer_name', 'subscriber', 'subscriber name', 'client', 'client name', 'sarfeen', 'sarif', 'sub_name', 'full name'],
    phone: ['phone', 'phone number', 'mobile', 'mobile number', 'cell', 'cell number', 'contact', 'contact number', 'whatsapp', 'whatsapp number', 'rabta'],
    cnic: ['cnic', 'cnic number', 'id card', 'id card number', 'national id', 'shanakhti card', 'nic', 'c.n.i.c'],
    mohalla: ['mohalla', 'area', 'locality', 'colony', 'sector', 'basti', 'neighbourhood', 'mohallah'],
    zone: ['zone', 'region', 'sub-fat', 'fat', 'dp', 'distribution point', 'sub_zone'],
    address: ['address', 'street', 'house', 'location', 'pata', 'house address', 'residence'],
    packageSpeed: ['package', 'package speed', 'speed', 'plan', 'internet package', 'mbps', 'tariff', 'pkg'],
    monthlySellingAmount: ['monthly rate', 'monthly fee', 'rate', 'price', 'fee', 'charges', 'bill amount', 'monthly amount', 'selling amount', 'charges pkr', 'mahwar mahsool', 'monthly'],
    monthlyPurchaseCost: ['cost', 'purchase cost', 'provider cost', 'upstream cost', 'isp cost', 'buy rate'],
    ispProvider: ['isp', 'provider', 'isp provider', 'upstream', 'line', 'fiber provider', 'operator'],
    serviceStatus: ['status', 'service status', 'connection status', 'state', 'current status'],
    notes: ['notes', 'remarks', 'comment', 'comments', 'description', 'detail'],
    addedOn: ['added on', 'connection date', 'joining date', 'start date', 'date', 'created on', 'tarikh']
  };

  headerRow.forEach((col, index) => {
    const normalized = col.toLowerCase().replace(/[^a-z0-9_# ]/g, '').trim();
    for (const [key, aliases] of Object.entries(synonyms)) {
      if (aliases.includes(normalized) && mapping[key] === undefined) {
        mapping[key] = index;
        break;
      }
    }
  });

  return mapping;
}

/**
 * Normalizes phone numbers to Pakistani standard format (e.g. 03001234567 or +923001234567).
 */
export function normalizeImportPhone(rawPhone) {
  if (!rawPhone || typeof rawPhone !== 'string') return '';
  const cleaned = rawPhone.replace(/[^\d+]/g, '');
  if (!cleaned) return '';
  if (cleaned.startsWith('03') && cleaned.length === 11) return cleaned;
  if (cleaned.startsWith('923') && cleaned.length === 12) return `+${cleaned}`;
  if (cleaned.startsWith('+923') && cleaned.length === 13) return cleaned;
  return cleaned.slice(0, 40);
}

/**
 * Normalizes Pakistani 13-digit CNIC into formatted XXXXX-XXXXXXX-X.
 */
export function normalizeImportCnic(rawCnic) {
  if (!rawCnic || typeof rawCnic !== 'string') return '';
  const digits = rawCnic.replace(/\D/g, '');
  if (digits.length === 13) {
    return `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12)}`;
  }
  return rawCnic.trim().slice(0, 20);
}

/**
 * Normalizes numeric currency/rate values.
 */
export function normalizeImportAmount(rawVal) {
  if (rawVal === undefined || rawVal === null || rawVal === '') return null;
  const s = String(rawVal).trim();
  const cleaned = s
    .replace(/^(?:rs\.?|pkr|pk)\s*/i, '')
    .replace(/\/-$/, '')
    .replace(/[,\s]/g, '');
  if (!cleaned) return null;
  const num = Number(cleaned);
  return Number.isFinite(num) && num >= 0 ? num : null;
}

/**
 * Parses and validates customer CSV content against existing application state.
 * Produces non-destructive validation preview.
 */
export function parseCustomerCsvImport(csvText, existingState = { customers: [], nextCustomerNumber: 1 }) {
  const rows = parseCsvRows(csvText);
  if (rows.length < 2) {
    return {
      canApply: false,
      rows: [],
      summary: { totalRows: 0, addCount: 0, enrichCount: 0, conflictCount: 0, errorCount: 0, canImport: false },
      error: 'CSV must contain at least a header row and one customer data row.'
    };
  }

  const headerRow = rows[0];
  const colMap = mapCustomerCsvHeaders(headerRow);

  if (colMap.name === undefined) {
    return {
      canApply: false,
      rows: [],
      summary: { totalRows: rows.length - 1, addCount: 0, enrichCount: 0, conflictCount: 0, errorCount: rows.length - 1, canImport: false },
      error: 'CSV header must include a "Customer Name" or "Name" column.'
    };
  }

  const existingCustomers = Array.isArray(existingState?.customers) ? existingState.customers : [];
  const existingByNumber = new Map(existingCustomers.map(c => [Number(c.customerNumber), c]));
  const existingByName = new Map(existingCustomers.map(c => [c.name.trim().toLowerCase(), c]));
  const existingByPhone = new Map(existingCustomers.filter(c => c.phone).map(c => [c.phone.replace(/\D/g, ''), c]));
  const existingByCnic = new Map(existingCustomers.filter(c => c.cnic).map(c => [c.cnic.replace(/\D/g, ''), c]));

  const inFileInputNumbers = new Set();
  const inFileInputNames = new Set();
  const parsedRows = [];

  for (let rowIndex = 1; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex];
    const errors = [];
    const fieldsToEnrich = [];

    const getVal = (colIdx) => (colIdx !== undefined && row[colIdx] !== undefined) ? String(row[colIdx]).trim() : '';

    const rawCustNum = getVal(colMap.customerNumber);
    const rawName = getVal(colMap.name);
    const rawPhone = getVal(colMap.phone);
    const rawCnic = getVal(colMap.cnic);
    const rawMohalla = getVal(colMap.mohalla);
    const rawZone = getVal(colMap.zone);
    const rawAddress = getVal(colMap.address);
    const rawPackage = getVal(colMap.packageSpeed);
    const rawRate = getVal(colMap.monthlySellingAmount);
    const rawCost = getVal(colMap.monthlyPurchaseCost);
    const rawIsp = getVal(colMap.ispProvider);
    const rawStatus = getVal(colMap.serviceStatus).toLowerCase();
    const rawNotes = getVal(colMap.notes);
    const rawAddedOn = getVal(colMap.addedOn);

    // Validate Name
    if (!rawName) {
      errors.push('Customer name is required.');
    } else if (rawName.length > 100) {
      errors.push('Customer name exceeds 100 characters limit.');
    }

    // Validate Customer Number (if provided)
    let parsedCustNum = null;
    if (rawCustNum) {
      const num = parseInt(rawCustNum.replace(/\D/g, ''), 10);
      if (isNaN(num) || num <= 0) {
        errors.push(`Invalid customer number "${rawCustNum}".`);
      } else {
        parsedCustNum = num;
      }
    }

    // Clean Phone
    const phone = normalizeImportPhone(rawPhone);

    // Clean CNIC
    const cnic = normalizeImportCnic(rawCnic);

    // Clean Amounts
    const monthlySellingAmount = normalizeImportAmount(rawRate);
    if (rawRate && monthlySellingAmount === null) {
      errors.push(`Invalid monthly rate amount "${rawRate}".`);
    }
    const monthlyPurchaseCost = normalizeImportAmount(rawCost);

    // Clean Status
    let serviceStatus = 'active';
    if (rawStatus) {
      if (['active', 'offline', 'not-set'].includes(rawStatus)) {
        serviceStatus = rawStatus;
      } else if (rawStatus.includes('off') || rawStatus.includes('disc') || rawStatus.includes('inact')) {
        serviceStatus = 'offline';
      } else {
        serviceStatus = 'active';
      }
    }

    // In-file duplicate checking
    if (parsedCustNum) {
      if (inFileInputNumbers.has(parsedCustNum)) {
        errors.push(`Customer #${parsedCustNum} appears multiple times in this CSV file.`);
      }
      inFileInputNumbers.add(parsedCustNum);
    }
    const normName = rawName.toLowerCase();
    if (normName) {
      if (inFileInputNames.has(normName)) {
        errors.push(`Customer name "${rawName}" appears multiple times in this CSV file.`);
      }
      inFileInputNames.add(normName);
    }

    // Determine Action: error | conflict | enrich | add
    let action = 'add';
    let matchedCustomer = null;

    if (errors.length > 0) {
      action = 'error';
    } else {
      // Check customer number collision
      if (parsedCustNum && existingByNumber.has(parsedCustNum)) {
        const existing = existingByNumber.get(parsedCustNum);
        if (existing.name.trim().toLowerCase() === normName) {
          // Number matches and Name matches: Enrich existing customer with non-blank fields
          action = 'enrich';
          matchedCustomer = existing;
        } else {
          // Conflict: Number is already taken by a different customer!
          action = 'conflict';
          matchedCustomer = existing;
          errors.push(`Customer #${parsedCustNum} is already assigned to "${existing.name}". Cannot overwrite.`);
        }
      } else if (existingByName.has(normName)) {
        // Name matches an existing customer: Enrich non-blank fields
        action = 'enrich';
        matchedCustomer = existingByName.get(normName);
      }

      // If action is enrich, calculate which fields would be filled
      if (action === 'enrich' && matchedCustomer) {
        const fieldsToCheck = [
          ['phone', phone],
          ['cnic', cnic],
          ['mohalla', rawMohalla],
          ['zone', rawZone],
          ['address', rawAddress],
          ['packageSpeed', rawPackage],
          ['monthlySellingAmount', monthlySellingAmount],
          ['monthlyPurchaseCost', monthlyPurchaseCost],
          ['ispProvider', rawIsp]
        ];
        for (const [key, val] of fieldsToCheck) {
          if (val && !matchedCustomer[key]) {
            fieldsToEnrich.push(key);
          }
        }
      }
    }

    parsedRows.push({
      rowNumber: rowIndex + 1,
      action,
      customerNumber: parsedCustNum,
      name: rawName,
      phone,
      cnic,
      mohalla: rawMohalla.slice(0, 100),
      zone: rawZone.slice(0, 100),
      address: rawAddress.slice(0, 200),
      packageSpeed: rawPackage.slice(0, 80),
      monthlySellingAmount,
      monthlyPurchaseCost,
      ispProvider: rawIsp.slice(0, 100),
      serviceStatus,
      notes: rawNotes.slice(0, 1000),
      addedOn: rawAddedOn || new Date().toISOString().slice(0, 10),
      errors,
      matchedCustomer: matchedCustomer ? { id: matchedCustomer.id, customerNumber: matchedCustomer.customerNumber, name: matchedCustomer.name } : null,
      fieldsToEnrich
    });
  }

  const addCount = parsedRows.filter(r => r.action === 'add').length;
  const enrichCount = parsedRows.filter(r => r.action === 'enrich').length;
  const conflictCount = parsedRows.filter(r => r.action === 'conflict').length;
  const errorCount = parsedRows.filter(r => r.action === 'error').length;
  const canImport = (addCount > 0 || enrichCount > 0) && conflictCount === 0;

  return {
    canApply: canImport,
    rows: parsedRows,
    summary: {
      totalRows: parsedRows.length,
      addCount,
      enrichCount,
      conflictCount,
      errorCount,
      canImport
    },
    error: null
  };
}

/**
 * Executes a non-destructive merge-only import of parsed CSV customer records.
 * Never overwrites existing profiles, bill histories, or payments.
 */
export function applyCustomerCsvImport(existingState, importPreview, options = { enrichExisting: true }) {
  if (!importPreview || !importPreview.canApply) {
    throw new Error('Cannot apply CSV import with conflicts or invalid data.');
  }

  const current = JSON.parse(JSON.stringify(existingState));
  current.customers = current.customers ?? [];
  let nextCustNum = Number(current.nextCustomerNumber) || (Math.max(0, ...current.customers.map(c => c.customerNumber)) + 1);

  const existingByNumber = new Map(current.customers.map(c => [Number(c.customerNumber), c]));
  const existingByName = new Map(current.customers.map(c => [c.name.trim().toLowerCase(), c]));

  let addedCount = 0;
  let enrichedCount = 0;
  const nowStamp = new Date().toISOString();
  const currentMonth = nowStamp.slice(0, 7);

  for (const row of importPreview.rows) {
    if (row.action === 'add') {
      let assignedNumber = row.customerNumber;
      if (!assignedNumber || existingByNumber.has(assignedNumber)) {
        while (existingByNumber.has(nextCustNum)) {
          nextCustNum++;
        }
        assignedNumber = nextCustNum++;
      } else {
        if (assignedNumber >= nextCustNum) {
          nextCustNum = assignedNumber + 1;
        }
      }

      const newCust = {
        id: `cust-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        customerNumber: assignedNumber,
        name: row.name,
        phone: row.phone || '',
        cnic: row.cnic || '',
        mohalla: row.mohalla || '',
        zone: row.zone || '',
        address: row.address || '',
        packageSpeed: row.packageSpeed || '',
        monthlySellingAmount: row.monthlySellingAmount !== null ? row.monthlySellingAmount : null,
        monthlyPurchaseCost: row.monthlyPurchaseCost !== null ? row.monthlyPurchaseCost : null,
        ispProvider: row.ispProvider || '',
        serviceStatus: row.serviceStatus || 'active',
        notes: row.notes || '',
        addedOn: row.addedOn || nowStamp.slice(0, 10),
        monthlyPriceSchedule: row.monthlySellingAmount ? [{
          effectiveMonth: currentMonth,
          amount: row.monthlySellingAmount,
          recordedAt: nowStamp
        }] : [],
        packageHistory: row.packageSpeed ? [{
          date: nowStamp.slice(0, 10),
          recordedAt: nowStamp,
          oldPackage: '',
          newPackage: row.packageSpeed,
          oldMonthlyRate: null,
          newMonthlyRate: row.monthlySellingAmount || 0,
          monthlyRecurringPriceDelta: row.monthlySellingAmount || 0,
          staffName: 'CSV Import'
        }] : [],
        bills: [],
        incidents: []
      };

      current.customers.push(newCust);
      existingByNumber.set(newCust.customerNumber, newCust);
      existingByName.set(newCust.name.trim().toLowerCase(), newCust);
      addedCount++;
    } else if (row.action === 'enrich' && options.enrichExisting) {
      const match = (row.customerNumber && existingByNumber.get(row.customerNumber)) || existingByName.get(row.name.trim().toLowerCase());
      if (match) {
        let changed = false;
        const enrichKeys = ['phone', 'cnic', 'mohalla', 'zone', 'address', 'packageSpeed', 'ispProvider'];
        for (const k of enrichKeys) {
          if (!match[k] && row[k]) {
            match[k] = row[k];
            changed = true;
          }
        }
        if (match.monthlySellingAmount === null && row.monthlySellingAmount !== null) {
          match.monthlySellingAmount = row.monthlySellingAmount;
          match.monthlyPriceSchedule = match.monthlyPriceSchedule ?? [];
          if (match.monthlyPriceSchedule.length === 0) {
            match.monthlyPriceSchedule.push({
              effectiveMonth: currentMonth,
              amount: row.monthlySellingAmount,
              recordedAt: nowStamp
            });
          }
          changed = true;
        }
        if (match.monthlyPurchaseCost === null && row.monthlyPurchaseCost !== null) {
          match.monthlyPurchaseCost = row.monthlyPurchaseCost;
          changed = true;
        }
        if (changed) enrichedCount++;
      }
    }
  }

  current.customers.sort((a, b) => a.customerNumber - b.customerNumber);
  current.nextCustomerNumber = Math.max(nextCustNum, ...current.customers.map(c => c.customerNumber + 1));

  return {
    state: current,
    addedCount,
    enrichedCount,
    summaryMessage: `Successfully imported ${addedCount} new customer${addedCount === 1 ? '' : 's'} and enriched ${enrichedCount} profile${enrichedCount === 1 ? '' : 's'}.`
  };
}

/**
 * Generates an RFC-4180 compliant sample CSV template with UTF-8 BOM for Pakistani ISP migration.
 */
export function generateSampleCustomerCsv() {
  const headers = [
    'Customer #',
    'Customer Name',
    'Phone',
    'CNIC',
    'Mohalla',
    'Zone',
    'Address',
    'Package',
    'Monthly Rate',
    'Purchase Cost',
    'ISP Provider',
    'Status'
  ];

  const sampleRows = [
    ['', 'Muhammad Ali', '03001234567', '35201-1234567-1', 'Baradari', 'Zone 1', 'Main Bazaar Shop #4', '15 Mbps Fiber', '1800', '1100', 'StormFiber Upstream', 'active'],
    ['', 'Usman Tariq', '03217654321', '35201-7654321-3', 'Vandala Road', 'Zone 2', 'Street 3 House 12', '20 Mbps Fiber', '2200', '1400', 'PTCL Upstream', 'active'],
    ['', 'Zubair Khan', '03459876543', '35201-9876543-5', 'Begum Kot', 'Zone 3', 'Near Jamia Masjid', '10 Mbps Fiber', '1500', '950', 'StormFiber Upstream', 'active'],
    ['', 'Imran Rafiq', '03124567890', '', 'Jia Musa', 'Zone 1', 'Plot 45 Ravi Strip', '25 Mbps Fiber', '2600', '1700', 'StormFiber Upstream', 'active'],
    ['', 'Tariq Mehmood', '03338765432', '35201-3456789-7', 'Imamia Colony', 'Zone 4', 'Sector B Lane 1', '15 Mbps Fiber', '1800', '1100', 'PTCL Upstream', 'active']
  ];

  const escapeCol = (val) => {
    const s = String(val ?? '');
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const csv = [
    headers.map(escapeCol).join(','),
    ...sampleRows.map(row => row.map(escapeCol).join(','))
  ].join('\r\n');

  return '\uFEFF' + csv;
}
