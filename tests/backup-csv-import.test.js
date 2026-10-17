import test from 'node:test';
import assert from 'node:assert/strict';
import {
  STORAGE_KEYS_CATALOG,
  inspectBackupFileHeader,
  verifyAllStorageKeysRoundTrip,
  parseCsvRows,
  mapCustomerCsvHeaders,
  normalizeImportPhone,
  normalizeImportCnic,
  normalizeImportAmount,
  parseCustomerCsvImport,
  applyCustomerCsvImport,
  generateSampleCustomerCsv
} from '../qa-backup-csv-import.js';
import { createInitialState, createJsonBackup, previewJsonBackupMerge, addCustomer } from '../core.js';

test('STORAGE_KEYS_CATALOG contains critical billing and operational store keys', () => {
  assert.ok(STORAGE_KEYS_CATALOG.length >= 15);
  const keys = STORAGE_KEYS_CATALOG.map(k => k.key);
  assert.ok(keys.includes('shahdara-isp-billing-v1'));
  assert.ok(keys.includes('shahdara_collection_targets'));
  assert.ok(keys.includes('shahdara_customer_adjustments'));
  assert.ok(keys.includes('shahdara_service_agreements'));
  assert.ok(keys.includes('shahdara_dispute_claims'));
  assert.ok(keys.includes('shahdara_equipment_retrievals_v1'));
  assert.ok(keys.includes('shahdara_collection_promises_v1'));
  assert.ok(keys.includes('shahdara_receipts_shared_v1'));
  assert.ok(keys.includes('shahdara_offline_payment_queue'));
  assert.ok(keys.includes('shahdara_late_fee_policy_v1'));
  assert.ok(keys.includes('shahdara_theme'));
  assert.ok(keys.includes('shahdara_language'));
});

test('verifyAllStorageKeysRoundTrip tests persistence and handles corrupted JSON safely', () => {
  const store = new Map();
  const mockStorage = {
    getItem(key) { return store.has(key) ? store.get(key) : null; },
    setItem(key, val) { store.set(key, String(val)); },
    removeItem(key) { store.delete(key); }
  };

  const result = verifyAllStorageKeysRoundTrip(mockStorage);
  assert.equal(result.allPassed, true);
  assert.equal(result.passedKeys, STORAGE_KEYS_CATALOG.length);
  assert.ok(result.results.every(r => r.roundTripPassed && r.corruptedHandled));
});

test('inspectBackupFileHeader identifies corrupted, oversized, wrong format and version mismatches', () => {
  assert.equal(inspectBackupFileHeader('').valid, false);
  assert.equal(inspectBackupFileHeader('not a json').valid, false);

  const wrongFormat = JSON.stringify({ format: 'other-app', formatVersion: 1, state: {} });
  const wrongRes = inspectBackupFileHeader(wrongFormat);
  assert.equal(wrongRes.valid, false);
  assert.match(wrongRes.error, /Unrecognized backup format/);

  const newerVersion = JSON.stringify({ format: 'shahdara-isp-billing-backup', formatVersion: 2, state: {} });
  const newerRes = inspectBackupFileHeader(newerVersion);
  assert.equal(newerRes.valid, false);
  assert.match(newerRes.error, /newer than supported/);

  const validBackup = JSON.stringify({
    format: 'shahdara-isp-billing-backup',
    formatVersion: 1,
    exportedAt: '2026-10-18T00:00:00Z',
    state: { customers: [{ id: '1', name: 'Ali' }] }
  });
  const validRes = inspectBackupFileHeader(validBackup);
  assert.equal(validRes.valid, true);
  assert.equal(validRes.customerCount, 1);
});

test('parseCsvRows parses standard CSV, quotes, CRLF, LF, and UTF-8 BOM', () => {
  const csv = '\uFEFF"Customer #","Customer Name","Phone"\r\n1,"Ali, Muhammad","03001234567"\n2,"Usman ""Tariq""","03217654321"\r\n';
  const rows = parseCsvRows(csv);
  assert.equal(rows.length, 3);
  assert.deepEqual(rows[0], ['Customer #', 'Customer Name', 'Phone']);
  assert.deepEqual(rows[1], ['1', 'Ali, Muhammad', '03001234567']);
  assert.deepEqual(rows[2], ['2', 'Usman "Tariq"', '03217654321']);
});

test('mapCustomerCsvHeaders flexibly matches Pakistani synonyms for column names', () => {
  const headers = ['Sr #', 'Subscriber Name', 'Mobile Number', 'ID Card', 'Area', 'Tariff', 'Monthly Fee'];
  const mapping = mapCustomerCsvHeaders(headers);
  assert.equal(mapping.customerNumber, 0);
  assert.equal(mapping.name, 1);
  assert.equal(mapping.phone, 2);
  assert.equal(mapping.cnic, 3);
  assert.equal(mapping.mohalla, 4);
  assert.equal(mapping.packageSpeed, 5);
  assert.equal(mapping.monthlySellingAmount, 6);
});

test('normalizeImportPhone and normalizeImportCnic format Pakistani contacts properly', () => {
  assert.equal(normalizeImportPhone('0300-1234567'), '03001234567');
  assert.equal(normalizeImportPhone('+92 300 1234567'), '+923001234567');
  assert.equal(normalizeImportPhone('923001234567'), '+923001234567');

  assert.equal(normalizeImportCnic('3520112345671'), '35201-1234567-1');
  assert.equal(normalizeImportCnic('35201-1234567-1'), '35201-1234567-1');
  assert.equal(normalizeImportAmount('Rs. 2,500.00'), 2500);
  assert.equal(normalizeImportAmount(''), null);
});

test('parseCustomerCsvImport detects new profiles, enrichable profiles, conflicts, and errors', () => {
  const existingState = {
    customers: [
      { id: 'c1', customerNumber: 1, name: 'Tariq Javed', phone: '', cnic: '', mohalla: 'Baradari', bills: [], packageHistory: [], monthlyPriceSchedule: [] },
      { id: 'c2', customerNumber: 2, name: 'Kashif Ali', phone: '03001111111', cnic: '35201-1111111-1', mohalla: 'Vandala', bills: [], packageHistory: [], monthlyPriceSchedule: [] }
    ],
    nextCustomerNumber: 3
  };

  const csvContent = [
    'Customer #,Customer Name,Phone,CNIC,Area,Package,Monthly Rate',
    ',Zahid Mehmood,03009999999,35201-9999999-9,Begum Kot,15 Mbps,1800', // New customer -> add
    '1,Tariq Javed,03215555555,35201-5555555-5,Baradari,20 Mbps,2200',     // Matching name & number -> enrich
    '2,Different Person,03456666666,,Vandala,10 Mbps,1500',                 // Number 2 conflict! -> conflict
    ',,03000000000,,Jia Musa,10 Mbps,1200'                                 // Blank name -> error
  ].join('\r\n');

  const preview = parseCustomerCsvImport(csvContent, existingState);
  assert.equal(preview.summary.totalRows, 4);
  assert.equal(preview.summary.addCount, 1);
  assert.equal(preview.summary.enrichCount, 1);
  assert.equal(preview.summary.conflictCount, 1);
  assert.equal(preview.summary.errorCount, 1);
  assert.equal(preview.canApply, false); // Blocked due to conflict!

  const conflictRow = preview.rows.find(r => r.action === 'conflict');
  assert.ok(conflictRow.errors[0].includes('already assigned'));

  const enrichRow = preview.rows.find(r => r.action === 'enrich');
  assert.ok(enrichRow.fieldsToEnrich.includes('phone'));
  assert.ok(enrichRow.fieldsToEnrich.includes('cnic'));
});

test('applyCustomerCsvImport performs safe, non-destructive merge and increments nextCustomerNumber', () => {
  const existingState = {
    customers: [
      { id: 'c1', customerNumber: 1, name: 'Tariq Javed', phone: '', cnic: '', mohalla: 'Baradari', monthlySellingAmount: null, bills: [], packageHistory: [], monthlyPriceSchedule: [] }
    ],
    nextCustomerNumber: 2
  };

  const validCsv = [
    'Customer Name,Phone,CNIC,Area,Package,Monthly Rate',
    'Zahid Mehmood,03009999999,35201-9999999-9,Begum Kot,15 Mbps,1800',
    'Tariq Javed,03215555555,35201-5555555-5,Baradari,20 Mbps,2200'
  ].join('\r\n');

  const preview = parseCustomerCsvImport(validCsv, existingState);
  assert.equal(preview.canApply, true);
  assert.equal(preview.summary.addCount, 1);
  assert.equal(preview.summary.enrichCount, 1);

  const applied = applyCustomerCsvImport(existingState, preview, { enrichExisting: true });
  assert.equal(applied.addedCount, 1);
  assert.equal(applied.enrichedCount, 1);
  assert.equal(applied.state.customers.length, 2);

  const newCust = applied.state.customers.find(c => c.name === 'Zahid Mehmood');
  assert.equal(newCust.customerNumber, 2);
  assert.equal(newCust.phone, '03009999999');
  assert.equal(newCust.monthlySellingAmount, 1800);

  const enrichedCust = applied.state.customers.find(c => c.name === 'Tariq Javed');
  assert.equal(enrichedCust.phone, '03215555555');
  assert.equal(enrichedCust.cnic, '35201-5555555-5');
  assert.equal(enrichedCust.monthlySellingAmount, 2200);

  assert.equal(applied.state.nextCustomerNumber, 3);
});

test('generateSampleCustomerCsv returns valid UTF-8 BOM CSV with Shahdara presets', () => {
  const sample = generateSampleCustomerCsv();
  assert.ok(sample.startsWith('\uFEFF'));
  const rows = parseCsvRows(sample);
  assert.ok(rows.length >= 4);
  assert.equal(rows[0][1], 'Customer Name');
  assert.ok(rows.some(r => r.includes('Muhammad Ali')));
  assert.ok(rows.some(r => r.includes('Baradari')));
});

test('core JSON backup preserves CNIC and non-destructively merges CNIC into local profile', () => {
  let state = createInitialState();
  state = addCustomer(state, 'CNIC Test Customer', new Date('2026-10-01'));
  const cust = state.customers.find(c => c.name === 'CNIC Test Customer');
  cust.cnic = '35201-9876543-2';

  const backupJson = createJsonBackup(state, new Date('2026-10-18T00:00:00Z'));
  const parsed = JSON.parse(backupJson);
  assert.equal(parsed.state.customers.find(c => c.name === 'CNIC Test Customer').cnic, '35201-9876543-2');

  // Now create local state where this customer has empty CNIC
  const localState = JSON.parse(JSON.stringify(state));
  localState.customers.find(c => c.name === 'CNIC Test Customer').cnic = '';

  const mergePreview = previewJsonBackupMerge(localState, backupJson);
  assert.equal(mergePreview.canApply, true);
  const mergedCust = mergePreview.state.customers.find(c => c.name === 'CNIC Test Customer');
  assert.equal(mergedCust.cnic, '35201-9876543-2');
});
