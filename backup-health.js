/**
 * backup-health.js — SISP-10: Backup Health Badge & Checksum Transfer.
 *
 * Pure module, zero imports, so it runs unchanged in the browser bundle and
 * in Node unit tests. Two jobs:
 *
 * 1. Checksum-verified transfer: every JSON backup created by
 *    `createJsonBackup` (core.js) carries a top-level `checksum` field — a
 *    CRC-32 over a canonical (key-sorted) form of the rest of the document.
 *    `previewJsonBackupMerge` apply-blocks a backup whose checksum
 *    mismatches (corrupted or edited in transit — the preview reports
 *    `checksumStatus: 'mismatch'` and `canApply: false`, so no data is ever
 *    overwritten) and reports `checksumStatus: 'unverified'` for legacy
 *    backups that predate the field, which still import with a warning.
 *    Deep validation still runs before the checksum verdict, so specific
 *    validation errors are never masked by a mismatch. Old app versions
 *    ignore the unknown field, so backups stay compatible in both directions.
 *
 * 2. Backup health assessment: the top-bar badge thresholds from the spec —
 *    Safe when the last off-device export is < 24h ago, Due at 1–3 days,
 *    Critical past 3 days, or once 10+ new payments land after the last
 *    export (the spec's test criterion: 10 payments flip the indicator).
 *    Never exported is Critical.
 */

// ---------------------------------------------------------------- CRC-32 --
// IEEE 802.3 CRC-32 (polynomial 0xEDB88320), computed over UTF-8 bytes.
// Synchronous on purpose: `createJsonBackup` / `previewJsonBackupMerge` are
// synchronous, and CRC is what the spec allows ("SHA-256 / CRC").

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    table[n] = c >>> 0;
  }
  return table;
})();

function utf8Bytes(text) {
  if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(text);
  // Fallback for environments without TextEncoder.
  const encoded = unescape(encodeURIComponent(text));
  const bytes = new Uint8Array(encoded.length);
  for (let i = 0; i < encoded.length; i++) bytes[i] = encoded.charCodeAt(i);
  return bytes;
}

export function crc32Hex(text) {
  const bytes = utf8Bytes(String(text));
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) crc = CRC_TABLE[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8);
  return ((crc ^ 0xFFFFFFFF) >>> 0).toString(16).padStart(8, '0');
}

// Canonical JSON: recursively sort object keys so the checksum survives key
// reordering and pretty-printing (e.g. a backup opened and re-saved by an
// editor). Mirrors JSON.stringify semantics for undefined/function values.
export function canonicalize(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(item => canonicalize(item) ?? 'null').join(',')}]`;
  const keys = Object.keys(value).sort();
  const parts = [];
  for (const key of keys) {
    const rendered = canonicalize(value[key]);
    if (rendered !== undefined) parts.push(`${JSON.stringify(key)}:${rendered}`);
  }
  return `{${parts.join(',')}}`;
}

// Checksum over a backup document WITHOUT its own checksum field, so the
// field never has to hash itself. Callers pass the document object before
// the field is attached (export) or after stripping it (verify).
export function computeBackupChecksum(documentObject) {
  if (!documentObject || typeof documentObject !== 'object' || Array.isArray(documentObject)) return null;
  const { checksum: _ignored, ...rest } = documentObject;
  return `crc32:${crc32Hex(canonicalize(rest))}`;
}

// Verify a backup text. Never throws for malformed input — callers that
// already parsed the JSON only see 'verified' | 'unverified' | 'mismatch'.
// 'unverified' = legacy backup without a checksum field: still importable,
// but the UI must warn that integrity could not be confirmed.
export function verifyBackupChecksum(backupText) {
  let documentObject;
  try { documentObject = JSON.parse(backupText); }
  catch { return { status: 'invalid', expected: null, actual: null }; }
  if (!documentObject || typeof documentObject !== 'object' || Array.isArray(documentObject)) {
    return { status: 'invalid', expected: null, actual: null };
  }
  const expected = documentObject.checksum;
  if (typeof expected !== 'string' || !expected) return { status: 'unverified', expected: null, actual: null };
  const actual = computeBackupChecksum(documentObject);
  return expected === actual
    ? { status: 'verified', expected, actual }
    : { status: 'mismatch', expected, actual };
}

// ------------------------------------------------------------- health state --
// Off-device exports only (JSON download / share / encrypted export / sync-code
// copy). Local IndexedDB snapshots do NOT reset this record: a browser cache
// clear wipes them too, so only a copy that left the device counts as safe.
export const BACKUP_HEALTH_KEY = 'sisp_backup_health_v1';
export const BACKUP_HEALTH_PAYMENT_THRESHOLD = 10;
export const BACKUP_HEALTH_SAFE_MS = 24 * 60 * 60 * 1000;
export const BACKUP_HEALTH_DUE_MS = 3 * 24 * 60 * 60 * 1000;

export function countAllPayments(state) {
  if (!state || !Array.isArray(state.customers)) return 0;
  let total = 0;
  for (const customer of state.customers) {
    for (const bill of customer?.bills ?? []) total += (bill?.payments ?? []).length;
  }
  return total;
}

// Fallback counter for ledgers whose export predates the health record:
// payments dated strictly after the export's calendar date. Payment dates
// are YYYY-MM-DD only, so a payment recorded later on the SAME day as the
// export cannot be distinguished by date — the count-based record (written
// at export time) is exact, and this date fallback is only used until the
// first new-format export.
export function countPaymentsAfterDate(state, exportDateKey) {
  if (!state || !Array.isArray(state.customers) || typeof exportDateKey !== 'string' || !exportDateKey) return 0;
  let total = 0;
  for (const customer of state.customers) {
    for (const bill of customer?.bills ?? []) {
      for (const payment of bill?.payments ?? []) {
        if (typeof payment?.date === 'string' && payment.date > exportDateKey) total++;
      }
    }
  }
  return total;
}

// Spec thresholds: Safe < 24h; Due 1–3 days; Critical > 3 days, or 10+ new
// payments since the last export, or never exported.
export function assessBackupHealth({ lastExportAt, paymentsSinceExport, now = new Date() } = {}) {
  const current = now instanceof Date ? now : new Date(now);
  const exported = lastExportAt ? new Date(lastExportAt) : null;
  if (!exported || Number.isNaN(exported.getTime()) || Number.isNaN(current.getTime())) {
    return {
      status: 'critical', emoji: '🔴', label: 'Backup: Never',
      title: 'No off-device backup recorded. Tap to download a JSON backup now.',
      pulse: true
    };
  }
  if (Number.isFinite(paymentsSinceExport) && paymentsSinceExport >= BACKUP_HEALTH_PAYMENT_THRESHOLD) {
    return {
      status: 'critical', emoji: '🔴', label: 'Backup: Critical',
      title: `${paymentsSinceExport} new payments since the last backup. Tap to download a JSON backup now.`,
      pulse: true
    };
  }
  const ageMs = Math.max(0, current.getTime() - exported.getTime());
  if (ageMs < BACKUP_HEALTH_SAFE_MS) {
    return {
      status: 'safe', emoji: '🟢', label: 'Backup: Safe',
      title: 'Last off-device backup was less than 24 hours ago. Tap to download a fresh copy.',
      pulse: false
    };
  }
  if (ageMs <= BACKUP_HEALTH_DUE_MS) {
    return {
      status: 'due', emoji: '🟡', label: 'Backup: Due',
      title: 'Last off-device backup is 1–3 days old. Tap to download a fresh JSON backup.',
      pulse: false
    };
  }
  return {
    status: 'critical', emoji: '🔴', label: 'Backup: Critical',
    title: 'Last off-device backup is over 3 days old. Tap to download a JSON backup now.',
    pulse: true
  };
}
