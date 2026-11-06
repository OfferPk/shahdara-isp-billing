// Customer gate and access instruction note (Plan 367): one short
// access instruction per customer, shown at the top of the profile and
// beside the customer on the visit list, in plain words — how to reach
// the customer at the door, for example "call first" or "ask at the
// neighbour's shop". It is an instruction note only: it is not the
// access difficulty record (Plan 245), which logs difficulties per
// premises with a type and dated updates, and it is not the safety note
// (Plan 153), which warns about hazards at a location. It appears on
// the profile and on visit lists for that customer; a customer without
// one shows nothing extra. The note never changes any visit, ticket,
// bill, or payment record by itself, and it is never sent anywhere.
//
// The module never reads storage, the clock, the network, or the page.
// Inputs are never mutated.

export const GATE_ACCESS_INSTRUCTION_STORE_KEY = 'shahdara_gai_notes_v1';
export const GATE_ACCESS_INSTRUCTION_TEXT_MAX_LENGTH = 200;
export const GATE_ACCESS_INSTRUCTION_BY_MAX_LENGTH = 60;

const GATE_ACCESS_INSTRUCTION_DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function cleanGateAccessInstructionText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function cleanGateAccessInstructionKey(value) {
  return cleanGateAccessInstructionText(value).toLowerCase();
}

function isGateAccessInstructionLeapYear(year) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

/** Strict YYYY-MM-DD validation against the real calendar (leap-aware). */
export function isStrictGateAccessInstructionDate(value) {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12) return false;
  let limit = GATE_ACCESS_INSTRUCTION_DAYS_IN_MONTH[month - 1];
  if (month === 2 && isGateAccessInstructionLeapYear(year)) limit = 29;
  return day >= 1 && day <= limit;
}

function escapeGateAccessInstructionHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

export function normalizeGateAccessInstruction(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = cleanGateAccessInstructionText(raw.id);
  const customerId = cleanGateAccessInstructionText(raw.customerId);
  const instruction = cleanGateAccessInstructionText(raw.instruction).slice(0, GATE_ACCESS_INSTRUCTION_TEXT_MAX_LENGTH);
  const notedBy = cleanGateAccessInstructionText(raw.notedBy).slice(0, GATE_ACCESS_INSTRUCTION_BY_MAX_LENGTH);
  const notedDate = cleanGateAccessInstructionText(raw.notedDate);
  if (!id || !customerId) return null;
  if (!instruction) return null;
  if (notedDate && !isStrictGateAccessInstructionDate(notedDate)) return null;
  return { id, customerId, instruction, notedBy, notedDate };
}

export function normalizeGateAccessInstructionList(list) {
  if (!Array.isArray(list)) return [];
  const seenIds = new Set();
  const seenCustomers = new Set();
  const out = [];
  for (const raw of list) {
    const note = normalizeGateAccessInstruction(raw);
    if (!note) continue;
    const idKey = cleanGateAccessInstructionKey(note.id);
    const customerKey = cleanGateAccessInstructionKey(note.customerId);
    if (seenIds.has(idKey)) continue;
    if (seenCustomers.has(customerKey)) continue;
    seenIds.add(idKey);
    seenCustomers.add(customerKey);
    out.push(note);
  }
  return out;
}

/** Read the instruction list from a storage-like object (or [] when unreadable). */
export function loadGateAccessInstructionList(storage) {
  try {
    const raw = storage?.getItem?.(GATE_ACCESS_INSTRUCTION_STORE_KEY);
    return normalizeGateAccessInstructionList(raw ? JSON.parse(raw) : []);
  } catch {
    return [];
  }
}

/**
 * Record (or replace) the access instruction for one customer. One
 * instruction per customer: recording a new instruction for a customer
 * who already has one replaces that instruction in place. Returns the
 * list unchanged when the instruction is invalid (no id, no customer,
 * or empty instruction).
 */
export function recordGateAccessInstruction(list, note) {
  const normalized = normalizeGateAccessInstructionList(list);
  const fresh = normalizeGateAccessInstruction(note);
  if (!fresh) return normalized;
  const customerKey = cleanGateAccessInstructionKey(fresh.customerId);
  let replaced = false;
  const out = normalized.map(existing => {
    if (cleanGateAccessInstructionKey(existing.customerId) !== customerKey) return existing;
    replaced = true;
    return fresh;
  });
  return replaced ? out : [...normalized, fresh];
}

/** Remove the access instruction for one customer; nothing else changes. */
export function removeGateAccessInstruction(list, customerId) {
  const normalized = normalizeGateAccessInstructionList(list);
  const customerKey = cleanGateAccessInstructionKey(customerId);
  if (!customerKey) return normalized;
  return normalized.filter(note => cleanGateAccessInstructionKey(note.customerId) !== customerKey);
}

export function gateAccessInstructionForCustomer(list, customerId) {
  const key = cleanGateAccessInstructionKey(customerId);
  if (!key) return null;
  return normalizeGateAccessInstructionList(list).find(note => cleanGateAccessInstructionKey(note.customerId) === key) ?? null;
}

export function hasGateAccessInstruction(list, customerId) {
  return gateAccessInstructionForCustomer(list, customerId) !== null;
}

export function gateAccessInstructionSummaryText(list) {
  const count = normalizeGateAccessInstructionList(list).length;
  if (count === 0) return 'No gate access instruction noted.';
  if (count === 1) return '1 customer has a gate access instruction noted.';
  return `${count} customers have a gate access instruction noted.`;
}

export function gateAccessInstructionText(note) {
  const clean = normalizeGateAccessInstruction(note);
  return clean ? clean.instruction : '';
}

/** One line for a visit list beside the customer; empty when there is no instruction. */
export function gateAccessInstructionLineHtml(note) {
  const text = gateAccessInstructionText(note);
  if (!text) return '';
  return `<div class="gai-route-line">🚪 Access: ${escapeGateAccessInstructionHtml(text)}</div>`;
}

export function gateAccessInstructionSectionHtml(customer, list, labels = {}) {
  if (!customer || typeof customer !== 'object') return '';
  const note = gateAccessInstructionForCustomer(list, customer.id);
  const heading = cleanGateAccessInstructionText(labels.heading) || 'Gate and access';
  const placeholder = cleanGateAccessInstructionText(labels.placeholder) || 'e.g. Call first, ask at the neighbour’s shop';
  const notedByLabel = cleanGateAccessInstructionText(labels.notedBy) || 'Noted by';
  const dateLabel = cleanGateAccessInstructionText(labels.date) || 'Date';
  const saveLabel = cleanGateAccessInstructionText(labels.save) || 'Save';
  const removeLabel = cleanGateAccessInstructionText(labels.remove) || 'Remove';
  const noneText = cleanGateAccessInstructionText(labels.none) || 'No gate access instruction noted for this customer.';
  const currentHtml = note
    ? `<p class="gai-current"><strong>${escapeGateAccessInstructionHtml(note.instruction)}</strong>${note.notedBy || note.notedDate ? `<span class="gai-meta"> — ${escapeGateAccessInstructionHtml([note.notedBy, note.notedDate].filter(Boolean).join(', '))}</span>` : ''}</p>`
    : `<p class="gai-none">${escapeGateAccessInstructionHtml(noneText)}</p>`;
  const formHtml = `<form class="gai-form" id="gaiForm"><label for="gaiInstruction">${escapeGateAccessInstructionHtml(heading)}<input id="gaiInstruction" type="text" maxlength="200" placeholder="${escapeGateAccessInstructionHtml(placeholder)}" value="${note ? escapeGateAccessInstructionHtml(note.instruction) : ''}" required></label><label for="gaiBy">${escapeGateAccessInstructionHtml(notedByLabel)}<input id="gaiBy" type="text" maxlength="60" value="${note ? escapeGateAccessInstructionHtml(note.notedBy) : ''}"></label><label for="gaiDate">${escapeGateAccessInstructionHtml(dateLabel)}<input id="gaiDate" type="date" value="${note ? escapeGateAccessInstructionHtml(note.notedDate) : ''}"></label><button type="submit" class="primary-button" id="gaiSaveBtn">${escapeGateAccessInstructionHtml(saveLabel)}</button>${note ? `<button type="button" class="secondary-button" id="gaiRemoveBtn">${escapeGateAccessInstructionHtml(removeLabel)}</button>` : ''}</form>`;
  return `<section class="profile-custody-section profile-gate-access-instruction" aria-label="${escapeGateAccessInstructionHtml(heading)}"><h4>${escapeGateAccessInstructionHtml(heading)}</h4><p>First visits succeed instead of ending at a locked gate, which saves a wasted trip across the mohallas. This note changes nothing by itself.</p>${currentHtml}${formHtml}</section>`;
}
