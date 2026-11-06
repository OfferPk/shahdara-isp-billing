// Move-house history note (Plan 357): one history entry per move
// (old mohalla/address note, new mohalla/address note, move date),
// kept as history on the profile. It is a history note only — not the
// move-house pause and transfer, and not the shift audit log that
// updates the active address and can charge a shifting fee. Recording
// a move never changes any bill, payment, or dues by itself; a move
// entry is never edited, only annotated.
//
// The module never reads storage, the clock, the network, or the page.
// Inputs are never mutated.

export const MOVE_HISTORY_STORE_KEY = 'shahdara_mvh_moves_v1';
export const MOVE_HISTORY_MOHALLA_MAX_LENGTH = 60;
export const MOVE_HISTORY_ADDRESS_MAX_LENGTH = 120;
export const MOVE_HISTORY_ANNOTATION_MAX_LENGTH = 200;

const MOVE_HISTORY_DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function cleanMoveHistoryText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function cleanMoveHistoryKey(value) {
  return cleanMoveHistoryText(value).toLowerCase();
}

function isMoveHistoryLeapYear(year) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

/** Strict YYYY-MM-DD validation against the real calendar (leap-aware). */
export function isStrictMoveHistoryDate(value) {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12) return false;
  let limit = MOVE_HISTORY_DAYS_IN_MONTH[month - 1];
  if (month === 2 && isMoveHistoryLeapYear(year)) limit = 29;
  return day >= 1 && day <= limit;
}

function escapeMoveHistoryHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

function normalizeMoveHistoryAnnotation(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const text = cleanMoveHistoryText(raw.text).slice(0, MOVE_HISTORY_ANNOTATION_MAX_LENGTH);
  const date = cleanMoveHistoryText(raw.date);
  if (!text) return null;
  if (!isStrictMoveHistoryDate(date)) return null;
  return { text, date };
}

export function normalizeMoveHistoryEntry(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = cleanMoveHistoryText(raw.id);
  const customerId = cleanMoveHistoryText(raw.customerId);
  const oldMohalla = cleanMoveHistoryText(raw.oldMohalla).slice(0, MOVE_HISTORY_MOHALLA_MAX_LENGTH);
  const oldAddress = cleanMoveHistoryText(raw.oldAddress).slice(0, MOVE_HISTORY_ADDRESS_MAX_LENGTH);
  const newMohalla = cleanMoveHistoryText(raw.newMohalla).slice(0, MOVE_HISTORY_MOHALLA_MAX_LENGTH);
  const newAddress = cleanMoveHistoryText(raw.newAddress).slice(0, MOVE_HISTORY_ADDRESS_MAX_LENGTH);
  const moveDate = cleanMoveHistoryText(raw.moveDate);
  if (!id || !customerId) return null;
  if (!oldMohalla && !oldAddress && !newMohalla && !newAddress) return null;
  if (!isStrictMoveHistoryDate(moveDate)) return null;
  const annotations = Array.isArray(raw.annotations)
    ? raw.annotations.map(normalizeMoveHistoryAnnotation).filter(Boolean)
    : [];
  return { id, customerId, oldMohalla, oldAddress, newMohalla, newAddress, moveDate, annotations };
}

export function normalizeMoveHistoryList(list) {
  if (!Array.isArray(list)) return [];
  const seenIds = new Set();
  const out = [];
  for (const raw of list) {
    const entry = normalizeMoveHistoryEntry(raw);
    if (!entry) continue;
    const idKey = cleanMoveHistoryKey(entry.id);
    if (seenIds.has(idKey)) continue;
    seenIds.add(idKey);
    out.push(entry);
  }
  return out;
}

export function recordMoveHistoryEntry(list, entry) {
  const normalized = normalizeMoveHistoryList(list);
  const fresh = normalizeMoveHistoryEntry(entry);
  if (!fresh) return normalized;
  if (normalized.some(existing => cleanMoveHistoryKey(existing.id) === cleanMoveHistoryKey(fresh.id))) return normalized;
  return [...normalized, fresh];
}

/**
 * Add a note to a move entry. The entry itself is never edited: only an
 * annotation is appended, and the old/new mohalla, old/new address and
 * move date stay exactly as recorded. Returns the list unchanged when
 * the entry is unknown, the note is empty, or the note date is not a
 * real calendar date.
 */
export function annotateMoveHistoryEntry(list, id, text, date) {
  const normalized = normalizeMoveHistoryList(list);
  const note = normalizeMoveHistoryAnnotation({ text, date });
  if (!note) return normalized;
  const idKey = cleanMoveHistoryKey(id);
  let changed = false;
  const out = normalized.map(entry => {
    if (cleanMoveHistoryKey(entry.id) !== idKey) return entry;
    changed = true;
    return { ...entry, annotations: [...entry.annotations, note] };
  });
  return changed ? out : normalized;
}

function compareMoveHistoryEntries(a, b) {
  if (a.moveDate !== b.moveDate) return a.moveDate < b.moveDate ? 1 : -1;
  return cleanMoveHistoryKey(a.id).localeCompare(cleanMoveHistoryKey(b.id));
}

export function moveHistoryForCustomer(list, customerId) {
  const key = cleanMoveHistoryKey(customerId);
  if (!key) return [];
  return normalizeMoveHistoryList(list)
    .filter(entry => cleanMoveHistoryKey(entry.customerId) === key)
    .sort(compareMoveHistoryEntries);
}

/**
 * The current address is always the latest entry: the new mohalla and
 * address of the newest move. Empty when no move is recorded.
 */
export function currentAddressForCustomer(list, customerId) {
  const moves = moveHistoryForCustomer(list, customerId);
  if (!moves.length) return { mohalla: '', address: '' };
  const latest = moves[0];
  return { mohalla: latest.newMohalla, address: latest.newAddress };
}

export function moveHistoryRowText(entry) {
  if (!entry || typeof entry !== 'object') return '';
  const from = [cleanMoveHistoryText(entry.oldMohalla), cleanMoveHistoryText(entry.oldAddress)].filter(Boolean).join(', ') || 'previous address not recorded';
  const to = [cleanMoveHistoryText(entry.newMohalla), cleanMoveHistoryText(entry.newAddress)].filter(Boolean).join(', ') || 'new address not recorded';
  return `${to} — moved ${cleanMoveHistoryText(entry.moveDate)} — from ${from}`;
}

export function moveHistorySummaryText(entries) {
  const list = Array.isArray(entries) ? entries : [];
  if (list.length === 0) return 'No move recorded yet.';
  if (list.length === 1) return '1 move recorded.';
  return `${list.length} moves recorded.`;
}

export function moveHouseHistorySectionHtml(customer, entries) {
  if (!customer || typeof customer !== 'object') return '';
  const moves = moveHistoryForCustomer(entries, customer.id);
  const current = currentAddressForCustomer(entries, customer.id);
  const currentLine = moves.length
    ? `<p class="mvh-current">Current address: ${escapeMoveHistoryHtml([current.mohalla, current.address].filter(Boolean).join(', ') || 'not recorded')} — from the latest move on ${escapeMoveHistoryHtml(moves[0].moveDate)}.</p>`
    : '<p class="mvh-current">No move recorded yet — the address on the profile is the current one.</p>';
  const listHtml = moves.length
    ? `<ul class="mvh-list">${moves.map(entry => {
      const annotationsHtml = entry.annotations.length
        ? `<ul class="mvh-annotations">${entry.annotations.map(note => `<li>${escapeMoveHistoryHtml(note.text)}<span class="mvh-annotation-date">noted ${escapeMoveHistoryHtml(note.date)}</span></li>`).join('')}</ul>`
        : '';
      return `<li><span class="mvh-move">${escapeMoveHistoryHtml(moveHistoryRowText(entry))}</span>${annotationsHtml}<form class="mvh-annotate" data-move-history-annotate="${escapeMoveHistoryHtml(entry.id)}"><label>Add a note to this move<input type="text" maxlength="200" placeholder="e.g. keys handed over" required></label><label>Date<input type="date" class="mvh-annotate-date" required></label><button type="submit" class="secondary-button">Add note</button></form></li>`;
    }).join('')}</ul>`
    : '<p class="mvh-none">No move recorded yet.</p>';
  const formHtml = `<form class="mvh-form" id="mvhForm"><label for="mvhOldMohalla">Old mohalla<input id="mvhOldMohalla" type="text" maxlength="60" placeholder="e.g. Mohalla A"></label><label for="mvhOldAddress">Old address<input id="mvhOldAddress" type="text" maxlength="120"></label><label for="mvhNewMohalla">New mohalla<input id="mvhNewMohalla" type="text" maxlength="60" placeholder="e.g. Mohalla B"></label><label for="mvhNewAddress">New address<input id="mvhNewAddress" type="text" maxlength="120"></label><label for="mvhDate">Move date<input id="mvhDate" type="date" required></label><button type="submit" class="primary-button" id="mvhSaveBtn">Record move</button></form>`;
  return `<section class="profile-custody-section profile-move-house-history" aria-label="Move-house history"><h4>Move-house history</h4><p>When a customer moves within Shahdara, the old address is kept here as history, so the collector follows the person instead of a stale address. Recording a move never changes any bill, payment, or dues; a move entry is never edited, only annotated.</p>${currentLine}<p class="mvh-summary">${escapeMoveHistoryHtml(moveHistorySummaryText(moves))}</p>${listHtml}${formHtml}</section>`;
}
