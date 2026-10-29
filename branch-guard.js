/**
 * branch-guard.js — SISP-46 Multi-Branch Merge Guard.
 *
 * The ledger lives in exactly one browser. The dangerous moment is a
 * backup restore: if the owner restores a backup on a second device (or
 * a branch office copies the file), BOTH copies keep collecting real
 * money independently, and a later merge-only restore would union the
 * two histories — a collection recorded on both sides under different
 * receipt ids would be counted twice, and nobody would notice.
 *
 * The guard gives every copy a lineage identity:
 *  - Each installation owns a `branchId` (born with the copy) and an
 *    `instanceId` (this browser install). The copy's current LINEAGE is
 *    inherited through backups: applying a backup on an empty device
 *    adopts the backup's lineage, so the normal one-device-at-a-time
 *    hand-off (export → restore on the new phone → keep working there)
 *    stays silent and unblocked.
 *  - Every exported backup carries a stamp in `settings.branchGuard`:
 *    { lineageId, seq, stampId, parentStampId, instanceId, exportedAt,
 *    fingerprint }. `seq` advances by one per export from the lineage
 *    head, and `parentStampId` names the exact stamp the exporter
 *    descended from, so a true descendant is recognisable even after
 *    merges union extra records into the state.
 *  - On restore, core.js classifies the incoming stamp against the
 *    local guard record:
 *      descendant / same-point / own / adopt  → silent, merge as usual
 *      legacy (no stamp) / unguarded (no local record) → WARN, allowed
 *        (old backups are never bricked by the guard)
 *      foreign (different lineage, non-empty local ledger) → BLOCKED
 *      diverged / stale fork (same lineage, other instance, chain does
 *        not descend from the local head) → BLOCKED
 *    A blocked merge can only proceed when the operator explicitly
 *    arms the override in the restore preview; the merge itself stays
 *    merge-only (existing records win every conflict, nothing is ever
 *    overwritten), and the override is written into the guard's event
 *    log. The guard NEVER auto-resolves a financial conflict.
 *
 * The record lives under its own localStorage key and is sanitized on
 * every read: a malformed record degrades to "unguarded" instead of
 * breaking restores.
 */

export const BRANCH_GUARD_KEY = 'sisp_branch_guard_v1';

const MAX_ID_LENGTH = 120;
const MAX_EVENTS = 25;

function defaultIdFactory() {
  try {
    if (typeof globalThis !== 'undefined' && globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  } catch { /* fall through to the manual id */ }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}${Math.random().toString(36).slice(2, 10)}`;
}

function cleanId(value) {
  return typeof value === 'string' && value.length > 0 && value.length <= MAX_ID_LENGTH ? value : null;
}

function cleanStampId(value) {
  return typeof value === 'string' && value.length > 0 && value.length <= MAX_ID_LENGTH + 16 ? value : null;
}

function cleanFingerprint(value) {
  return typeof value === 'string' && /^[0-9a-f]{8}$/.test(value) ? value : '';
}

function cleanIso(value) {
  if (typeof value !== 'string' || !value) return null;
  return Number.isFinite(Date.parse(value)) ? value : null;
}

/** Canonical (key-sorted) JSON so fingerprints ignore key order. */
function canonicalJson(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const keys = Object.keys(value).filter(key => value[key] !== undefined && typeof value[key] !== 'function').sort();
  return `{${keys.map(key => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
}

/**
 * Deterministic 32-bit FNV-1a fingerprint of a ledger state. Used only
 * to recognise "same content" points in a lineage, never as a security
 * checksum (backups carry the SISP-10 checksum for integrity).
 */
export function fingerprintState(state) {
  const text = canonicalJson(state ?? null);
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

/**
 * Sanitize an export stamp (the object stored in a backup's
 * `settings.branchGuard`). Returns null when the stamp is absent or
 * malformed — callers treat null as a legacy (pre-guard) backup.
 */
export function sanitizeBranchGuardStamp(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const lineageId = cleanId(value.lineageId);
  const instanceId = cleanId(value.instanceId);
  const seq = Number(value.seq);
  if (!lineageId || !instanceId || !Number.isSafeInteger(seq) || seq < 1) return null;
  const stampId = cleanStampId(value.stampId) || `${seq}:${instanceId}`;
  return {
    lineageId,
    seq,
    instanceId,
    stampId,
    parentStampId: cleanStampId(value.parentStampId) || '',
    exportedAt: cleanIso(value.exportedAt),
    fingerprint: cleanFingerprint(value.fingerprint),
    prevFingerprint: cleanFingerprint(value.prevFingerprint)
  };
}

function sanitizeEvent(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const type = typeof value.type === 'string' && value.type.length <= 40 ? value.type : null;
  if (!type) return null;
  return {
    at: cleanIso(value.at),
    type,
    lineageId: cleanId(value.lineageId),
    seq: Number.isSafeInteger(Number(value.seq)) && Number(value.seq) >= 0 ? Number(value.seq) : null,
    override: value.override === true
  };
}

/**
 * Sanitize the local guard record. Returns null when the record is
 * absent or unusable — the device is then "unguarded" (warn-only).
 */
export function sanitizeBranchGuard(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const branchId = cleanId(value.branchId);
  const instanceId = cleanId(value.instanceId);
  const lineageId = cleanId(value.lineageId);
  if (!branchId || !instanceId || !lineageId) return null;
  const headSeq = Number(value.headSeq);
  const events = Array.isArray(value.events) ? value.events.map(sanitizeEvent).filter(Boolean).slice(-MAX_EVENTS) : [];
  return {
    version: 1,
    branchId,
    instanceId,
    lineageId,
    createdAt: cleanIso(value.createdAt),
    headSeq: Number.isSafeInteger(headSeq) && headSeq >= 0 ? headSeq : 0,
    headStampId: cleanStampId(value.headStampId) || `0:${instanceId}`,
    headInstanceId: cleanId(value.headInstanceId) || instanceId,
    headFingerprint: cleanFingerprint(value.headFingerprint),
    events
  };
}

export function createBranchGuard({ idFactory = defaultIdFactory, now = new Date() } = {}) {
  const branchId = String(idFactory());
  const instanceId = String(idFactory());
  const at = (now instanceof Date ? now : new Date(now)).toISOString();
  return {
    version: 1,
    branchId,
    instanceId,
    lineageId: branchId,
    createdAt: at,
    headSeq: 0,
    headStampId: `0:${instanceId}`,
    headInstanceId: instanceId,
    headFingerprint: '',
    events: [{ at, type: 'created', lineageId: branchId, seq: 0, override: false }]
  };
}

function resolveStorage(storage) {
  if (storage) return storage;
  try { return typeof globalThis !== 'undefined' ? globalThis.localStorage : null; } catch { return null; }
}

export function loadBranchGuard(storage) {
  try {
    const store = resolveStorage(storage);
    if (!store) return null;
    const raw = store.getItem(BRANCH_GUARD_KEY);
    if (!raw) return null;
    return sanitizeBranchGuard(JSON.parse(raw));
  } catch {
    return null;
  }
}

/** Persists the guard record; never throws. */
export function saveBranchGuard(guard, storage) {
  try {
    const store = resolveStorage(storage);
    const clean = sanitizeBranchGuard(guard);
    if (!store || !clean) return false;
    store.setItem(BRANCH_GUARD_KEY, JSON.stringify(clean));
    return true;
  } catch {
    return false;
  }
}

/** Load the device's guard record, creating (and saving) one if needed. */
export function ensureBranchGuard(storage, deps = {}) {
  const existing = loadBranchGuard(storage);
  if (existing) return existing;
  const created = createBranchGuard(deps);
  saveBranchGuard(created, storage);
  return created;
}

function withEvent(guard, event) {
  return { ...guard, events: [...(guard.events ?? []), event].slice(-MAX_EVENTS) };
}

/**
 * Build the stamp for the next export from this copy. The stamp's
 * parent is the guard's current head, and its seq advances the head by
 * one — record it with recordBranchGuardExport once the backup exists.
 */
export function createBranchGuardStamp(guard, state, exportedAt = new Date()) {
  const clean = sanitizeBranchGuard(guard);
  if (!clean) return null;
  const seq = clean.headSeq + 1;
  return {
    lineageId: clean.lineageId,
    seq,
    instanceId: clean.instanceId,
    stampId: `${seq}:${clean.instanceId}`,
    parentStampId: clean.headStampId,
    exportedAt: (exportedAt instanceof Date ? exportedAt : new Date(exportedAt)).toISOString(),
    fingerprint: fingerprintState(state),
    prevFingerprint: clean.headFingerprint || ''
  };
}

/** Advance the guard head to a stamp this copy just exported. */
export function recordBranchGuardExport(guard, stamp, now = new Date()) {
  const clean = sanitizeBranchGuard(guard);
  const cleanStamp = sanitizeBranchGuardStamp(stamp);
  if (!clean || !cleanStamp) return clean;
  const at = (now instanceof Date ? now : new Date(now)).toISOString();
  return withEvent({
    ...clean,
    headSeq: cleanStamp.seq,
    headStampId: cleanStamp.stampId,
    headInstanceId: cleanStamp.instanceId,
    headFingerprint: cleanStamp.fingerprint || clean.headFingerprint
  }, { at, type: 'export', lineageId: cleanStamp.lineageId, seq: cleanStamp.seq, override: false });
}

/**
 * Classify an incoming backup stamp against the local guard record.
 * Pure and total: every input combination lands in exactly one status.
 *
 *   legacy     — backup has no usable stamp (pre-guard backup): warn.
 *   unguarded  — this device has no guard record: warn.
 *   adopt      — local ledger is empty: any lineage may move in, silent.
 *   descendant — stamp chains directly from the local head: silent.
 *   same-point — the stamp IS the local head: silent.
 *   own        — exported by this very instance: silent.
 *   foreign    — different lineage + non-empty local ledger: BLOCKED.
 *   diverged   — same lineage but the chain forks (another instance
 *                advanced from an older head, or the seq ran ahead
 *                without descending from our head): BLOCKED.
 */
export function classifyBranchGuardRestore({ guard, stamp, localCustomerCount = 0, localFingerprint = '' } = {}) {
  const cleanStamp = sanitizeBranchGuardStamp(stamp);
  if (!cleanStamp) return { status: 'legacy', blocked: false, requiresOverride: false, silent: false };
  const cleanGuard = sanitizeBranchGuard(guard);
  if (!cleanGuard) return { status: 'unguarded', blocked: false, requiresOverride: false, silent: false };
  if (!Number.isSafeInteger(localCustomerCount) || localCustomerCount <= 0) {
    return { status: 'adopt', blocked: false, requiresOverride: false, silent: true };
  }
  if (cleanStamp.lineageId !== cleanGuard.lineageId) {
    return { status: 'foreign', blocked: true, requiresOverride: true, silent: false };
  }
  if (cleanStamp.stampId === cleanGuard.headStampId) {
    return { status: 'same-point', blocked: false, requiresOverride: false, silent: true };
  }
  if (cleanStamp.instanceId === cleanGuard.instanceId) {
    return { status: 'own', blocked: false, requiresOverride: false, silent: true };
  }
  if (cleanStamp.seq > cleanGuard.headSeq && cleanStamp.parentStampId === cleanGuard.headStampId) {
    return { status: 'descendant', blocked: false, requiresOverride: false, silent: true };
  }
  if (cleanStamp.fingerprint && (cleanStamp.fingerprint === cleanGuard.headFingerprint || cleanStamp.fingerprint === localFingerprint)) {
    return { status: 'same-point', blocked: false, requiresOverride: false, silent: true };
  }
  return { status: 'diverged', blocked: true, requiresOverride: true, silent: false };
}

/**
 * Fold a successfully applied restore into the guard record.
 *  - adopt: the device takes the backup's lineage and head.
 *  - same-lineage applies at or beyond the head move the head to the
 *    applied stamp (an override-applied diverged backup thereby heals
 *    the chain for both copies); older applies keep the head.
 *  - foreign applies (override only) keep the local lineage and head —
 *    the other copy's future backups stay recognisably foreign.
 *  - legacy applies keep lineage/head; only the content fingerprint
 *    moves, and the event is logged.
 */
export function recordBranchGuardApply(guard, stamp, { status = '', override = false, resultingState = null, now = new Date() } = {}) {
  const clean = sanitizeBranchGuard(guard);
  if (!clean) return clean;
  const cleanStamp = sanitizeBranchGuardStamp(stamp);
  const at = (now instanceof Date ? now : new Date(now)).toISOString();
  const resultingFingerprint = resultingState ? fingerprintState(resultingState) : clean.headFingerprint;
  if (!cleanStamp) {
    return withEvent({ ...clean, headFingerprint: resultingFingerprint },
      { at, type: 'apply-legacy', lineageId: clean.lineageId, seq: clean.headSeq, override: false });
  }
  if (status === 'adopt') {
    return withEvent({
      ...clean,
      lineageId: cleanStamp.lineageId,
      headSeq: cleanStamp.seq,
      headStampId: cleanStamp.stampId,
      headInstanceId: clean.instanceId,
      headFingerprint: resultingFingerprint
    }, { at, type: 'adopt', lineageId: cleanStamp.lineageId, seq: cleanStamp.seq, override: false });
  }
  if (cleanStamp.lineageId !== clean.lineageId) {
    return withEvent({ ...clean, headFingerprint: resultingFingerprint },
      { at, type: 'apply-foreign-override', lineageId: cleanStamp.lineageId, seq: cleanStamp.seq, override: true });
  }
  const advances = cleanStamp.seq >= clean.headSeq;
  return withEvent({
    ...clean,
    headSeq: advances ? cleanStamp.seq : clean.headSeq,
    headStampId: advances ? cleanStamp.stampId : clean.headStampId,
    headInstanceId: clean.instanceId,
    headFingerprint: resultingFingerprint
  }, { at, type: override ? 'apply-diverged-override' : 'apply', lineageId: cleanStamp.lineageId, seq: cleanStamp.seq, override: override === true });
}
