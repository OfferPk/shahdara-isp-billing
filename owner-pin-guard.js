/**
 * owner-pin-guard.js — SISP-80: 4-Digit Owner PIN Lock for Partner
 * Profit, Expense Delete & Void Actions.
 *
 * The app is often handed to a collector / lineman for field work
 * (Quick Collect, Field Mode, receipts, complaints). Those flows must
 * stay 100% unlocked. What the owner does NOT want a helper poking at
 * is the money-oversight surface: Partner Settlement, the partners'
 * P&L share tabs, expense deletion, and payment voiding (SISP-34).
 *
 * Design:
 *  - The feature is DISABLED by default: no PIN record on the device
 *    means nothing ever prompts, anywhere. Existing tests and flows
 *    are untouched until the owner explicitly sets a PIN and turns
 *    Restricted Mode ON.
 *  - The record lives under its own device-local localStorage key
 *    (`sisp_owner_pin_v1`), like the SISP-46 branch guard — it is
 *    deliberately NOT part of the ledger backup: a backup file gets
 *    shared over WhatsApp/Drive (SISP-52), and a PIN hash must never
 *    travel inside it. Moving to a new phone means setting the PIN
 *    again, which is the safe default.
 *  - Only a HASH is stored: SHA-256 (WebCrypto `crypto.subtle`) of
 *    `salt:pin` with a per-record random salt. The plaintext PIN is
 *    never written to storage, never logged, and never rendered.
 *    If WebCrypto is unavailable the PIN cannot be set at all (fail
 *    closed at setup time) rather than degrading to a weak hash.
 *  - A correct entry unlocks the restricted surface for the rest of
 *    the app session (in-memory flag on the controller only — never
 *    persisted). Reloading the app re-locks. A wrong PIN keeps the
 *    dialog open with an error and unlocks nothing; cancelling the
 *    prompt resolves the guarded action as refused — there is no
 *    bypass path.
 *  - Restricted Mode is part of the same sanitized record
 *    (`restrictedMode: true`). A PIN with Restricted Mode OFF also
 *    prompts nowhere: the lock only bites when BOTH exist.
 */

import { t } from './nav-language.js';

export const OWNER_PIN_KEY = 'sisp_owner_pin_v1';
export const OWNER_PIN_LENGTH = 4;

/** The guarded actions. Anything not listed here is never gated. */
export const RESTRICTED_ACTIONS = Object.freeze([
  'partner-settlement',
  'partner-shares',
  'expense-delete',
  'payment-void'
]);

const SALT_HEX_LENGTH = 32; // 16 random bytes
const HASH_HEX_LENGTH = 64; // SHA-256 hex

/** A PIN is exactly 4 ASCII digits — nothing else is ever accepted. */
export function isValidOwnerPinFormat(pin) {
  return typeof pin === 'string' && /^[0-9]{4}$/.test(pin);
}

function cleanHex(value, length) {
  return typeof value === 'string' && value.length === length && /^[0-9a-f]+$/.test(value) ? value : null;
}

function cleanIso(value) {
  if (typeof value !== 'string' || !value) return null;
  return Number.isFinite(Date.parse(value)) ? value : null;
}

/**
 * Sanitize the stored record. Returns null when the record is absent
 * or unusable — callers treat null as "feature disabled", never as an
 * error, so a malformed record can never lock the owner out OR block
 * ordinary work.
 */
export function sanitizeOwnerPinRecord(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const salt = cleanHex(value.salt, SALT_HEX_LENGTH);
  const hash = cleanHex(value.hash, HASH_HEX_LENGTH);
  if (!salt || !hash) return null;
  return {
    version: 1,
    salt,
    hash,
    restrictedMode: value.restrictedMode === true,
    updatedAt: cleanIso(value.updatedAt)
  };
}

function resolveStorage(storage) {
  if (storage) return storage;
  try { return typeof globalThis !== 'undefined' ? globalThis.localStorage : null; } catch { return null; }
}

export function loadOwnerPinRecord(storage) {
  try {
    const store = resolveStorage(storage);
    if (!store) return null;
    const raw = store.getItem(OWNER_PIN_KEY);
    if (!raw) return null;
    return sanitizeOwnerPinRecord(JSON.parse(raw));
  } catch {
    return null;
  }
}

/** Persists the record; returns false instead of throwing. */
export function saveOwnerPinRecord(record, storage) {
  try {
    const store = resolveStorage(storage);
    const clean = sanitizeOwnerPinRecord(record);
    if (!store || !clean) return false;
    store.setItem(OWNER_PIN_KEY, JSON.stringify(clean));
    return true;
  } catch {
    return false;
  }
}

/** Removes the record entirely (PIN forgotten = feature disabled). */
export function clearOwnerPinRecord(storage) {
  try {
    const store = resolveStorage(storage);
    if (!store) return false;
    store.removeItem(OWNER_PIN_KEY);
    return true;
  } catch {
    return false;
  }
}

/** Random per-record salt (hex). Uses WebCrypto randomness when present. */
export function generateOwnerPinSalt() {
  const bytes = new Uint8Array(SALT_HEX_LENGTH / 2);
  try {
    if (globalThis?.crypto?.getRandomValues) {
      globalThis.crypto.getRandomValues(bytes);
      return [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
    }
  } catch { /* fall through to the Math.random fallback */ }
  let out = '';
  for (let i = 0; i < SALT_HEX_LENGTH; i++) out += Math.floor(Math.random() * 16).toString(16);
  return out;
}

function resolveSubtle(subtle) {
  if (subtle) return subtle;
  try { return globalThis?.crypto?.subtle ?? null; } catch { return null; }
}

/**
 * SHA-256 hex of `salt:pin`, or null when the PIN format is invalid
 * or WebCrypto subtle is unavailable. Async because subtle is async.
 */
export async function hashOwnerPin(pin, salt, subtle) {
  if (!isValidOwnerPinFormat(pin)) return null;
  if (!cleanHex(salt, SALT_HEX_LENGTH)) return null;
  const cryptoSubtle = resolveSubtle(subtle);
  if (!cryptoSubtle?.digest) return null;
  try {
    const data = new TextEncoder().encode(`${salt}:${pin}`);
    const digest = await cryptoSubtle.digest('SHA-256', data);
    return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return null;
  }
}

/**
 * Build a fresh record for a new PIN (new salt every time). Returns
 * null when the PIN is malformed or hashing is unavailable — the
 * caller must refuse setup rather than store anything weaker.
 */
export async function createOwnerPinRecord(pin, { restrictedMode = false, now = new Date(), subtle } = {}) {
  const salt = generateOwnerPinSalt();
  const hash = await hashOwnerPin(pin, salt, subtle);
  if (!hash) return null;
  return sanitizeOwnerPinRecord({
    version: 1,
    salt,
    hash,
    restrictedMode: restrictedMode === true,
    updatedAt: (now instanceof Date ? now : new Date(now)).toISOString()
  });
}

/** Constant-work comparison so verify does not leak prefix matches. */
function hashesEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** True only when the candidate PIN hashes to the stored hash. */
export async function verifyOwnerPin(record, pin, { subtle } = {}) {
  const clean = sanitizeOwnerPinRecord(record);
  if (!clean) return false;
  const candidate = await hashOwnerPin(pin, clean.salt, subtle);
  if (!candidate) return false;
  return hashesEqual(candidate, clean.hash);
}

/**
 * Feature status snapshot:
 *  - hasPin: a usable PIN record exists on this device;
 *  - restrictedMode: the owner toggled Restricted Mode ON;
 *  - active: the lock actually bites (needs BOTH).
 */
export function ownerPinStatus(record) {
  const clean = sanitizeOwnerPinRecord(record);
  const hasPin = clean !== null;
  const restrictedMode = hasPin && clean.restrictedMode === true;
  return { hasPin, restrictedMode, active: hasPin && restrictedMode };
}

/**
 * The single gate every restricted entry point consults.
 * Pure and total — every combination lands in exactly one decision:
 *   not-restricted  — action is not on the restricted list;
 *   no-pin          — feature disabled (no record): never blocks;
 *   mode-off        — PIN exists but Restricted Mode is OFF;
 *   session-unlocked— owner already proved the PIN this session;
 *   pin-required    — the ONLY blocking outcome.
 */
export function guardDecision(record, action, { sessionUnlocked = false } = {}) {
  if (!RESTRICTED_ACTIONS.includes(action)) return { blocked: false, reason: 'not-restricted' };
  const status = ownerPinStatus(record);
  if (!status.hasPin) return { blocked: false, reason: 'no-pin' };
  if (!status.restrictedMode) return { blocked: false, reason: 'mode-off' };
  if (sessionUnlocked === true) return { blocked: false, reason: 'session-unlocked' };
  return { blocked: true, reason: 'pin-required' };
}

/**
 * Dialog controller for the PIN prompt + PIN settings. The markup
 * lives in index.html (#ownerPinDialog, billing-modal shell →
 * var(--modal-surface)); this controller only fills and wires it.
 *
 * Session unlock choice: a successful PIN entry unlocks ALL
 * restricted actions until the app is reloaded (the flag lives only
 * in this closure). `lock()` re-locks immediately.
 */
export function setupOwnerPinGuard({ storage = null, onToast = null } = {}) {
  if (typeof document === 'undefined') return null;
  const dialog = document.getElementById('ownerPinDialog');
  if (!dialog) return null;

  const $ = id => document.getElementById(id);
  const promptSection = $('ownerPinPromptSection');
  const settingsSection = $('ownerPinSettingsSection');
  const promptInput = $('ownerPinPromptInput');
  const promptError = $('ownerPinPromptError');
  const promptTitle = $('ownerPinDialogTitle');
  const statusLine = $('ownerPinStatusLine');
  const currentInput = $('ownerPinCurrentInput');
  const currentField = $('ownerPinCurrentField');
  const newInput = $('ownerPinNewInput');
  const confirmInput = $('ownerPinConfirmInput');
  const modeToggle = $('ownerPinRestrictedToggle');
  const settingsError = $('ownerPinSettingsError');
  const removeBtn = $('ownerPinRemoveBtn');

  let sessionUnlocked = false;
  let pendingPrompt = null; // { resolve } while a prompt is open
  let dialogMode = 'prompt'; // 'prompt' | 'settings'

  const toast = (message, options) => { if (typeof onToast === 'function') onToast(message, options); };
  const loadRecord = () => loadOwnerPinRecord(storage);

  const showDialog = () => {
    if (dialog.open) return;
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.hidden = false;
  };
  const hideDialog = () => {
    if (typeof dialog.close === 'function' && dialog.open) dialog.close();
    else dialog.hidden = true;
  };

  function settlePrompt(result) {
    const pending = pendingPrompt;
    pendingPrompt = null;
    if (pending) pending.resolve(result);
  }

  function openPrompt() {
    dialogMode = 'prompt';
    if (promptSection) promptSection.hidden = false;
    if (settingsSection) settingsSection.hidden = true;
    if (promptTitle) promptTitle.textContent = t('pin_prompt_title');
    if (promptInput) promptInput.value = '';
    if (promptError) { promptError.textContent = ''; promptError.hidden = true; }
    showDialog();
    if (promptInput) promptInput.focus();
  }

  /** Ask for the PIN; resolves true only on a verified entry. */
  function promptForPin() {
    if (sessionUnlocked) return Promise.resolve(true);
    if (pendingPrompt) return pendingPrompt.promise;
    let resolve;
    const promise = new Promise(res => { resolve = res; });
    pendingPrompt = { resolve, promise };
    openPrompt();
    return promise;
  }

  /**
   * Gate used by app.js entry points. Resolves true when the action
   * may proceed (feature off, mode off, already unlocked, or the
   * owner just entered the correct PIN); false when it must not.
   */
  async function requireUnlock(action) {
    const decision = guardDecision(loadRecord(), action, { sessionUnlocked });
    if (!decision.blocked) return true;
    return promptForPin();
  }

  function renderSettings() {
    const status = ownerPinStatus(loadRecord());
    if (statusLine) {
      statusLine.textContent = !status.hasPin
        ? t('pin_status_no_pin')
        : status.restrictedMode ? t('pin_status_active') : t('pin_status_mode_off');
    }
    if (currentField) currentField.hidden = !status.hasPin;
    if (currentInput) currentInput.value = '';
    if (newInput) newInput.value = '';
    if (confirmInput) confirmInput.value = '';
    if (modeToggle) modeToggle.checked = status.restrictedMode;
    if (removeBtn) removeBtn.hidden = !status.hasPin;
    if (settingsError) { settingsError.textContent = ''; settingsError.hidden = true; }
  }

  function openSettings() {
    // Changing or removing the lock is itself owner-only while the
    // lock is active: prove the PIN first, same as any gated action.
    const status = ownerPinStatus(loadRecord());
    if (status.active && !sessionUnlocked) {
      promptForPin().then(ok => { if (ok) openSettings(); });
      return;
    }
    dialogMode = 'settings';
    if (promptSection) promptSection.hidden = true;
    if (settingsSection) settingsSection.hidden = false;
    if (promptTitle) promptTitle.textContent = t('pin_settings_title');
    renderSettings();
    showDialog();
  }

  function settingsFail(message) {
    if (settingsError) { settingsError.textContent = message; settingsError.hidden = false; }
    toast(message, { type: 'error' });
  }

  async function saveSettings() {
    const existing = loadRecord();
    const status = ownerPinStatus(existing);
    const currentPin = currentInput ? currentInput.value : '';
    const newPin = newInput ? newInput.value : '';
    const confirmPin = confirmInput ? confirmInput.value : '';
    const wantRestricted = modeToggle ? modeToggle.checked === true : false;

    // Any change to an existing lock needs the current PIN first.
    if (status.hasPin && !(await verifyOwnerPin(existing, currentPin))) {
      settingsFail(t('pin_current_wrong'));
      return;
    }
    if (newPin !== '' || !status.hasPin) {
      if (!isValidOwnerPinFormat(newPin)) { settingsFail(t('pin_format_error')); return; }
      if (newPin !== confirmPin) { settingsFail(t('pin_confirm_mismatch')); return; }
    }
    if (wantRestricted && !status.hasPin && newPin === '') {
      settingsFail(t('pin_format_error'));
      return;
    }
    let record;
    if (newPin !== '') {
      record = await createOwnerPinRecord(newPin, { restrictedMode: wantRestricted });
      if (!record) { settingsFail(t('pin_unavailable')); return; }
    } else {
      record = { ...existing, restrictedMode: wantRestricted, updatedAt: new Date().toISOString() };
    }
    if (!saveOwnerPinRecord(record, storage)) { settingsFail(t('pin_unavailable')); return; }
    // The owner just proved identity; keep the session unlocked.
    sessionUnlocked = true;
    toast(t('pin_saved'), { type: 'success' });
    hideDialog();
  }

  async function removePin() {
    const existing = loadRecord();
    if (!existing) { hideDialog(); return; }
    const currentPin = currentInput ? currentInput.value : '';
    if (!(await verifyOwnerPin(existing, currentPin))) {
      settingsFail(t('pin_current_wrong'));
      return;
    }
    clearOwnerPinRecord(storage);
    sessionUnlocked = false;
    toast(t('pin_removed'), { type: 'success' });
    hideDialog();
  }

  // ---- wiring (once) ----
  const unlockBtn = $('ownerPinUnlockBtn');
  if (unlockBtn) unlockBtn.addEventListener('click', async () => {
    const candidate = promptInput ? promptInput.value : '';
    const ok = await verifyOwnerPin(loadRecord(), candidate);
    if (ok) {
      sessionUnlocked = true;
      if (promptInput) promptInput.value = '';
      hideDialog();
      settlePrompt(true);
    } else {
      if (promptInput) { promptInput.value = ''; promptInput.focus(); }
      if (promptError) { promptError.textContent = t('pin_wrong'); promptError.hidden = false; }
    }
  });
  const promptCancelBtn = $('ownerPinPromptCancelBtn');
  if (promptCancelBtn) promptCancelBtn.addEventListener('click', () => { hideDialog(); settlePrompt(false); });
  const closeBtn = $('ownerPinCloseBtn');
  if (closeBtn) closeBtn.addEventListener('click', () => { hideDialog(); if (dialogMode === 'prompt') settlePrompt(false); });
  const settingsCloseBtn = $('ownerPinSettingsCloseBtn');
  if (settingsCloseBtn) settingsCloseBtn.addEventListener('click', () => hideDialog());
  const saveBtn = $('ownerPinSaveBtn');
  if (saveBtn) saveBtn.addEventListener('click', () => { saveSettings(); });
  if (removeBtn) removeBtn.addEventListener('click', () => { removePin(); });
  if (promptInput) promptInput.addEventListener('keydown', event => {
    if (event.key === 'Enter') { event.preventDefault(); if (unlockBtn) unlockBtn.click(); }
  });
  dialog.addEventListener('click', event => { if (event.target === dialog) { hideDialog(); if (dialogMode === 'prompt') settlePrompt(false); } });
  dialog.addEventListener('cancel', () => { if (dialogMode === 'prompt') settlePrompt(false); });

  const menuBtn = $('mobileMoreOwnerPinBtn');
  if (menuBtn) menuBtn.addEventListener('click', () => {
    const menu = $('mobileMoreMenu');
    if (menu) menu.hidden = true;
    openSettings();
  });

  return {
    requireUnlock,
    openSettings,
    promptForPin,
    isSessionUnlocked: () => sessionUnlocked,
    lock: () => { sessionUnlocked = false; },
    status: () => ownerPinStatus(loadRecord())
  };
}
