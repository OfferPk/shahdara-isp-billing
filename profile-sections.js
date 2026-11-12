/*
 * profile-sections.js — the Customer Profile's 7 expandable sections
 * (polish #28 Phase A).
 *
 * The Info tab renders as 7 native <details> sections (Customer
 * Information, Service & Package, Financial Details, Connection &
 * Installation, Network Configuration, Hardware & Equipment, History &
 * Activity) instead of one flat list. This module is the structure's
 * only logic: the section keys + default open state, the per-customer
 * open/closed store (UI state only — it never touches a customer, bill
 * or payment record), and the <details> shell builder.
 *
 * The caller passes the record store in, so this module reads no store,
 * clock, page or network itself. A missing key, unreadable text or a
 * wrong shape all read as "no saved state", never as a guessed open
 * state. The render replaces innerHTML on every profile render, so the
 * choice must live in the store to survive a re-render or a reload.
 */

export const PROFILE_SECTION_OPEN_KEY = 'shahdara_profile_section_open_v1';

export const PROFILE_SECTION_KEYS = Object.freeze([
  'customer',
  'service',
  'financial',
  'connection',
  'network',
  'hardware',
  'history',
]);

// Polish #28 Phase A default (Req 1, open question Q1): the operator
// opens a profile to check who the customer is, what service they have
// and what money is involved — S1/S2/S3 open, the other four on demand.
export const PROFILE_SECTION_DEFAULT_OPEN = Object.freeze({
  customer: true,
  service: true,
  financial: true,
  connection: false,
  network: false,
  hardware: false,
  history: false,
});

function escapeProfileSectionHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizeSectionOpenMap(map) {
  if (!map || typeof map !== 'object' || Array.isArray(map)) return {};
  const out = {};
  for (const [customerId, sections] of Object.entries(map)) {
    if (typeof customerId !== 'string' || customerId.length === 0) continue;
    if (!sections || typeof sections !== 'object' || Array.isArray(sections)) continue;
    const kept = {};
    for (const key of PROFILE_SECTION_KEYS) {
      if (typeof sections[key] === 'boolean') kept[key] = sections[key];
    }
    out[customerId] = kept;
  }
  return out;
}

/**
 * Reads the saved per-customer open/closed map back, or {} when nothing
 * usable was saved — a missing key, unreadable text, or a wrong shape
 * all read as no saved state, never as a guessed open state.
 *
 * @param {Object|null} storage - The record store, or null when
 *   storage is unavailable
 * @returns {Object} { [customerId]: { [sectionKey]: boolean } }
 */
export function loadProfileSectionOpen(storage) {
  if (!storage) return {};
  let raw = null;
  try {
    raw = storage.getItem(PROFILE_SECTION_OPEN_KEY);
  } catch {
    return {};
  }
  if (typeof raw !== 'string' || raw.length === 0) return {};
  let parsed = null;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {};
  }
  return normalizeSectionOpenMap(parsed);
}

/**
 * Saves the per-customer open/closed map on this device.
 *
 * @param {Object|null} storage - The record store, or null when
 *   storage is unavailable
 * @param {Object} map - The map to save, as read by
 *   loadProfileSectionOpen
 * @returns {boolean} True when the map was saved
 */
export function saveProfileSectionOpen(storage, map) {
  if (!storage) return false;
  try {
    storage.setItem(PROFILE_SECTION_OPEN_KEY, JSON.stringify(normalizeSectionOpenMap(map)));
    return true;
  } catch {
    return false;
  }
}

/**
 * The open state of one section for one customer: the stored choice
 * when one exists, the Phase A default otherwise. An unknown section
 * key reads closed.
 */
export function profileSectionOpenFor(customerId, stored, key) {
  const saved = stored?.[customerId]?.[key];
  if (typeof saved === 'boolean') return saved;
  return PROFILE_SECTION_DEFAULT_OPEN[key] ?? false;
}

/**
 * Returns a new map with one section's choice set for one customer.
 * Pure: the input map is never mutated, and unknown section keys are
 * ignored (they would be dropped on the next load anyway).
 */
export function withProfileSectionOpen(map, customerId, key, isOpen) {
  const next = normalizeSectionOpenMap(map);
  if (!PROFILE_SECTION_KEYS.includes(key)) return next;
  next[customerId] = { ...(next[customerId] ?? {}), [key]: Boolean(isOpen) };
  return next;
}

/**
 * The <details> shell for one profile section. The heading and summary
 * are escaped; the body is the section's already-rendered markup and
 * passes through untouched.
 *
 * Polish #28 Phase C (Req 5) — an optional editLabel adds a small Edit
 * button to the summary (class-found wiring in app.js opens the same
 * edit form at this section's group). Omitting it renders exactly the
 * Phase A output, so sections without an edit control are byte-identical.
 *
 * Profile Polish C (15) — an optional summaryHtml renders caller-owned
 * HTML inside the summary span instead of the escaped summary (the
 * section-header status pill). It passes through unescaped exactly
 * like the body, so the caller owns its escaping; omitting it renders
 * exactly the Phase A output, so sections without a pill are
 * byte-identical.
 */
export function profileDetailSectionHtml({ key, heading, summary, summaryHtml, body, open, editLabel }) {
  const edit = editLabel ? `<button type="button" class="profile-section-edit secondary-button" data-profile-section-edit="${escapeProfileSectionHtml(key)}">${escapeProfileSectionHtml(editLabel)}</button>` : '';
  const summaryInner = (typeof summaryHtml === 'string' && summaryHtml.length > 0)
    ? summaryHtml
    : escapeProfileSectionHtml(summary);
  return `<details class="profile-detail-section" data-profile-section="${escapeProfileSectionHtml(key)}"${open ? ' open' : ''}><summary><h3>${escapeProfileSectionHtml(heading)}</h3><span class="profile-section-summary">${summaryInner}</span>${edit}</summary><div class="profile-section-body">${body ?? ''}</div></details>`;
}
