/**
 * connector-polish-guard.js — SISP-167: SC/UPC (Blue) vs. SC/APC (Green)
 * Connector Polish Mismatch Guard.
 *
 * Problem: a blue SC/UPC patch cord mated to a green SC/APC splitter port
 * (or the reverse) leaves an air gap at the ferrule angle — roughly a
 * 3–5 dB return-loss penalty and a classic "weak signal, no visible fault"
 * complaint. The guard compares the polish recorded for the customer's
 * splitter box against the polish recorded for the customer's ONU and
 * warns only when BOTH sides are known and different.
 *
 * Storage (nothing is seeded, everything starts unknown):
 *   - customer.onuConnectorType: 'UPC' | 'APC' | '' (unknown) on the
 *     customer record, beside the SISP-24 optical fields; validated in
 *     core.js (addCustomer / updateCustomerProfile / readState /
 *     validateBackupState).
 *   - Box polish lives OUTSIDE the ledger state under its own
 *     localStorage key (sisp_splitter_polish_v1), a plain map
 *     { [splitterBoxId]: 'UPC' | 'APC' } keyed by the derived box id
 *     exactly as splitter-map.js's buildSplitterBoxes names boxes —
 *     splitter boxes are derived from customer records, so there is no
 *     box registry to hang the field on. It travels inside JSON backups
 *     as an optional `settings.splitterPolish` section under the SISP-15
 *     safe-merge rule (adopt only when this device has none, else a
 *     conflict is reported and nothing is overwritten).
 *
 * This module imports nothing, on purpose: core.js imports the
 * sanitizers from here for backup restore, and splitter-map.js imports
 * the evaluator for port badges — an import in either direction would
 * be a cycle. The box/port reads below mirror splitter-map.js's
 * normalizeOpticalFields rules (trimmed box id, integer port 1–16).
 *
 * Tests use synthetic data only.
 */

export const SPLITTER_POLISH_KEY = 'sisp_splitter_polish_v1';

export const CONNECTOR_POLISH_TYPES = Object.freeze(['UPC', 'APC']);

/** Display labels — technical names stay as-is in every language. */
export function polishLabel(type) {
  if (type === 'UPC') return 'SC/UPC (Blue)';
  if (type === 'APC') return 'SC/APC (Green)';
  return '';
}

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Normalizes any raw connector-polish value to 'UPC' | 'APC' | ''.
 * Anything else (lowercase, free text, numbers, objects) is unknown —
 * a physical fact is never guessed from a near-match.
 */
export function sanitizeOnuConnectorType(value) {
  return CONNECTOR_POLISH_TYPES.includes(value) ? value : '';
}

/**
 * Normalizes a raw splitter-polish map into { [boxId]: 'UPC' | 'APC' }.
 * Entries with a blank/overlong box id or a non-UPC/APC value are
 * dropped, never thrown on; non-object input becomes {}.
 */
export function sanitizeSplitterPolishMap(value) {
  const out = {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) return out;
  for (const [rawBoxId, rawType] of Object.entries(value)) {
    const boxId = cleanText(rawBoxId);
    if (!boxId || boxId.length > 100) continue;
    const type = sanitizeOnuConnectorType(rawType);
    if (!type) continue;
    out[boxId] = type;
  }
  return out;
}

/** Reads the saved box-polish map; {} on missing/corrupt storage. */
export function loadSplitterPolish(storage) {
  try {
    const store = storage || (typeof globalThis !== 'undefined' ? globalThis.localStorage : null);
    if (!store) return {};
    const raw = store.getItem(SPLITTER_POLISH_KEY);
    if (!raw) return {};
    return sanitizeSplitterPolishMap(JSON.parse(raw));
  } catch {
    return {};
  }
}

/** Persists the box-polish map (sanitized); never throws. */
export function saveSplitterPolish(map, storage) {
  try {
    const store = storage || (typeof globalThis !== 'undefined' ? globalThis.localStorage : null);
    if (!store) return false;
    store.setItem(SPLITTER_POLISH_KEY, JSON.stringify(sanitizeSplitterPolishMap(map)));
    return true;
  } catch {
    return false;
  }
}

/**
 * Pure: returns a NEW polish map with `boxId` set to `type`. An empty /
 * unknown type REMOVES the box's entry (back to unknown). The input map
 * is never mutated.
 */
export function setSplitterPolish(map, boxId, type) {
  const clean = sanitizeSplitterPolishMap(map);
  const id = cleanText(boxId);
  if (!id || id.length > 100) return clean;
  const cleanType = sanitizeOnuConnectorType(type);
  if (!cleanType) {
    delete clean[id];
    return clean;
  }
  return { ...clean, [id]: cleanType };
}

/** The polish recorded for one box: 'UPC' | 'APC' | '' (unknown). */
export function boxPolishFor(polishMap, boxId) {
  const clean = sanitizeSplitterPolishMap(polishMap);
  return clean[cleanText(boxId)] ?? '';
}

/**
 * The guard itself. Mismatch ONLY when both sides are known and
 * different; either side unknown → 'unknown' (no warning anywhere —
 * a physical fact is never guessed).
 *
 * Returns { status: 'match' | 'mismatch' | 'unknown', boxPolish, onuType }
 * with boxPolish / onuType each 'UPC' | 'APC' | ''.
 */
export function evaluateConnectorMismatch(customer, polishMap) {
  const boxId = cleanText(customer?.splitterBoxId);
  const onuType = sanitizeOnuConnectorType(customer?.onuConnectorType);
  const boxPolish = boxId ? boxPolishFor(polishMap, boxId) : '';
  if (!boxPolish || !onuType) return { status: 'unknown', boxPolish, onuType };
  return { status: boxPolish === onuType ? 'match' : 'mismatch', boxPolish, onuType };
}

function assignedPort(customer) {
  const raw = customer?.splitterPort;
  const n = raw === '' || raw === null || raw === undefined ? null : Number(raw);
  return Number.isInteger(n) && n >= 1 && n <= 16 ? n : null;
}

/**
 * Fleet view: every ACTIVE customer assigned to a splitter box port
 * whose box↔ONU polish pair mismatches. Box-less customers are excluded
 * (nothing to compare), port-less assignments are excluded (not on a
 * port), archived customers are excluded. Accepts the app state object
 * or a bare customers array. Read-only — the input is never mutated.
 */
export function buildPolishMismatchReport(state, polishMap) {
  const customers = Array.isArray(state) ? state : (Array.isArray(state?.customers) ? state.customers : []);
  const mismatches = [];
  for (const customer of customers) {
    if (!customer || customer.archived === true) continue;
    const boxId = cleanText(customer.splitterBoxId);
    if (!boxId) continue;
    const port = assignedPort(customer);
    if (port === null) continue;
    const result = evaluateConnectorMismatch(customer, polishMap);
    if (result.status !== 'mismatch') continue;
    mismatches.push({
      customerId: customer.id ?? null,
      customerName: customer.name ?? '',
      customerNumber: customer.customerNumber ?? null,
      boxId,
      splitterPort: port,
      boxPolish: result.boxPolish,
      onuType: result.onuType
    });
  }
  mismatches.sort((a, b) => (a.boxId < b.boxId ? -1 : a.boxId > b.boxId ? 1 : (a.splitterPort - b.splitterPort)));
  return { mismatches, count: mismatches.length };
}
