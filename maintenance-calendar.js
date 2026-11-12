// Plan 48 (Plan 1-100) — Planned maintenance calendar by mohalla.
//
// Planned work — a splitter swap, a cable re-route, an upstream
// window — is announced ad hoc, so affected households hear about it
// late or not at all, and it is later confused with an unplanned
// outage. This module is the calendar for that work: one scheduled
// window per record — date, start/end time, affected mohallas or
// segments, work description, and status — plus the exact list of
// customers it affects and, on completion, an announcement draft for
// those mohallas through the existing WhatsApp route.
//
// Scope fence, stated plainly:
//   - It is import-free: the caller supplies every window, every
//     customer, and every connection record, and the module never
//     reads storage, the clock, or the network, and never mutates
//     an input.
//   - It is a calendar only. Creating, starting, postponing, or
//     completing a window never changes a bill, a payment, a ticket,
//     or a customer status, and it never writes into any of those
//     records. A completed window stays in the list as history, with
//     its final times, rather than disappearing.
//   - It is NOT the outage grouping (Plan 22): unplanned faults stay
//     there. A maintenance window is planned work, announced in
//     advance, and never mixed into the outage list.
//   - It is NOT the broadcast panel (Plan 14): Plan 14 owns editable
//     bilingual announcement templates for any announcement. This
//     module owns the schedule and the affected-customer list, and
//     only prepares one completion draft for its own windows, in
//     the same no-recipient WhatsApp form (the draft text is built
//     here, so app.js never embeds a wa.me literal in a
//     window.open call, the Plan 14 precedent).
//   - Mohalla addressing mirrors the Plan T canonical rule, as
//     mohalla-broadcast.js does: the leading generic "Mohalla"
//     word is stripped, comparison is case-insensitive, and known
//     spellings collapse (bani -> BANII, kishti -> KISHTII,
//     chamyaa -> CHAMYAAA). A segment is a splitter name from the
//     connection register (Plan 17): matched case-insensitively
//     after trimming, so "Splitter A" and "splitter a" are one
//     segment, never two.
//   - A window with no date, an impossible date (2026-02-30), an
//     invalid time, an end time not after its start time, a blank
//     description, or no affected mohalla and no affected segment
//     is refused outright, never stored half-formed. Missing final
//     times on completion keep the scheduled times; a final time
//     is never guessed from anything else.

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

const DEFAULT_MOHALLAS = Object.freeze([
  'CHARYAA', 'GANGALL', 'KISHTII', 'BARRIAN', 'THALII', 'CHAMYAAA',
  'PALALIYAA', 'MALLA', 'NAKAR', 'BANII', 'SODAA', 'PULL SIDE',
  'JABBIYAA', 'MOHALLA CHUDRIYAA', 'MOHALLA end side farm house',
  // Sharafat 76 (owner decision 2026-11-12): END POINT is the 16th
  // mohalla — Haweli and End Point are one mohalla (#12 in the
  // numbered display order). "end side farm house" stays separate.
  'END POINT',
]);

const MOHALLA_ALIASES = Object.freeze({
  bani: 'BANII',
  kishti: 'KISHTII',
  chamyaa: 'CHAMYAAA',
  // Owner-confirmed 2026-11-11: JABBIYAAA is the same mohalla as
  // JABBIYAA. Charyaa is NOT an alias — it is its own mohalla.
  jabbiyaaa: 'JABBIYAA',
});

export const MAINTENANCE_STATUSES = Object.freeze({
  SCHEDULED: 'scheduled',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  POSTPONED: 'postponed',
});

const STATUS_TRANSITIONS = Object.freeze({
  scheduled: ['in_progress', 'postponed', 'completed'],
  in_progress: ['completed', 'postponed'],
  postponed: ['scheduled'],
  completed: [],
});

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizedText(value) {
  return String(value ?? '').normalize('NFKC').replace(/\s+/gu, ' ').trim();
}

function comparisonKey(value) {
  return normalizedText(value).toLowerCase();
}

function stripMohallaPrefix(value) {
  const stripped = normalizedText(value).replace(/^(?:mohalla|mohalaa)\s+/iu, '');
  return stripped || normalizedText(value);
}

function readableLabel(value) {
  const readableWord = (word) => {
    const letters = word.match(/\p{L}/gu) ?? [];
    if (letters.length >= 2 && letters.length <= 3 && letters.every((letter) => letter === letter.toLocaleUpperCase('en-US'))) return word;
    const chars = Array.from(word);
    if (!chars.length) return word;
    return chars[0].toLocaleUpperCase('en-US') + chars.slice(1).join('').toLocaleLowerCase('en-US');
  };
  return normalizedText(value).split(' ').map((word) => word.split(/([-–—/])/u).map((part) => /^[-–—/]$/u.test(part) ? part : readableWord(part)).join('')).join(' ');
}

// Mirrors mohalla-broadcast.js canonicalBroadcastMohalla without
// importing it. Returns { key, label, stored } or null when blank.
export function canonicalMaintenanceMohalla(value) {
  const raw = normalizedText(value);
  if (!raw) return null;
  const stripped = stripMohallaPrefix(raw);
  const key = comparisonKey(stripped);
  const canonical = DEFAULT_MOHALLAS.find((name) => comparisonKey(stripMohallaPrefix(name)) === key) ?? MOHALLA_ALIASES[key];
  if (canonical) return { key: comparisonKey(stripMohallaPrefix(canonical)), label: readableLabel(canonical), stored: canonical };
  return { key, label: readableLabel(stripped), stored: raw };
}

function resolveMohallas(values) {
  const seen = new Map();
  for (const raw of Array.isArray(values) ? values : []) {
    const canon = canonicalMaintenanceMohalla(raw);
    if (canon && !seen.has(canon.key)) seen.set(canon.key, canon);
  }
  return [...seen.values()];
}

function resolveSegments(values) {
  const seen = new Map();
  for (const raw of Array.isArray(values) ? values : []) {
    const label = text(raw);
    if (!label) continue;
    const key = label.toLowerCase();
    if (!seen.has(key)) seen.set(key, { key, label });
  }
  return [...seen.values()];
}

export function isValidMaintenanceDate(value) {
  if (typeof value !== 'string' || !DATE_PATTERN.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export function isValidMaintenanceTime(value) {
  return typeof value === 'string' && TIME_PATTERN.test(value);
}

function normalizeStatus(value) {
  const raw = text(value);
  if (!raw) return MAINTENANCE_STATUSES.SCHEDULED;
  const key = raw.toLowerCase().replace(/[\s-]+/g, '_');
  return Object.values(MAINTENANCE_STATUSES).includes(key) ? key : null;
}

// One normalised window, or null when it fails any honesty rule.
// Blank final fields stay null ("not recorded"), never guessed:
// a window that has not been completed has no final times yet.
export function normalizeMaintenanceWindow(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const id = text(raw.id);
  const date = text(raw.date);
  const startTime = text(raw.startTime ?? raw.start);
  const endTime = text(raw.endTime ?? raw.end);
  const description = text(raw.description ?? raw.work);
  const status = normalizeStatus(raw.status);
  if (!id || !isValidMaintenanceDate(date) || !isValidMaintenanceTime(startTime)
    || !isValidMaintenanceTime(endTime) || endTime <= startTime || !description || status === null) return null;
  const mohallas = resolveMohallas(raw.mohallas ?? raw.areas);
  const segments = resolveSegments(raw.segments ?? raw.splitters);
  if (mohallas.length === 0 && segments.length === 0) return null;
  const finalDate = text(raw.finalDate);
  const finalStartTime = text(raw.finalStartTime ?? raw.finalStart);
  const finalEndTime = text(raw.finalEndTime ?? raw.finalEnd);
  if (finalDate && !isValidMaintenanceDate(finalDate)) return null;
  if (finalStartTime && !isValidMaintenanceTime(finalStartTime)) return null;
  if (finalEndTime && !isValidMaintenanceTime(finalEndTime)) return null;
  if (finalStartTime && finalEndTime && finalEndTime <= finalStartTime) return null;
  return {
    id,
    date,
    startTime,
    endTime,
    description,
    status,
    mohallas: mohallas.map((m) => m.stored),
    segments: segments.map((s) => s.label),
    note: text(raw.note) || null,
    finalDate: finalDate || null,
    finalStartTime: finalStartTime || null,
    finalEndTime: finalEndTime || null,
    announcementDraft: text(raw.announcementDraft) || null,
  };
}

export function normalizeMaintenanceWindows(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const raw of list) {
    const normalized = normalizeMaintenanceWindow(raw);
    if (normalized) out.push(normalized);
  }
  return out;
}

function compareWindows(a, b) {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  if (a.startTime !== b.startTime) return a.startTime < b.startTime ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export function sortMaintenanceWindows(list) {
  // Exported for the calendar view; windows render date-then-time.
  return normalizeMaintenanceWindows(list).sort(compareWindows);
}

// Saves (or re-saves) one window. An invalid window leaves the list
// unchanged (same reference, so the caller can tell nothing was
// stored); a valid one returns a new list, never a mutated input.
// A duplicate id replaces the earlier window, so re-saving a
// corrected window never creates a second row for it.
export function upsertMaintenanceWindow(list, raw) {
  const normalized = normalizeMaintenanceWindow(raw);
  if (!normalized) return list;
  const current = normalizeMaintenanceWindows(list);
  const existing = current.findIndex((item) => item.id === normalized.id);
  if (existing >= 0) {
    const next = current.slice();
    next[existing] = normalized;
    return next;
  }
  return [...current, normalized];
}

export function removeMaintenanceWindow(list, id) {
  const key = text(id);
  if (!key) return Array.isArray(list) ? list : [];
  return normalizeMaintenanceWindows(list).filter((item) => item.id !== key);
}

export function findMaintenanceWindow(list, id) {
  const key = text(id);
  if (!key) return null;
  return normalizeMaintenanceWindows(list).find((item) => item.id === key) ?? null;
}

// Moves one window along the status machine. An unknown window, an
// unknown target status, or a forbidden transition leaves the list
// unchanged (same reference); a legal move returns a new list.
// Completing a window keeps it in the list as history: when the
// caller supplies final times they are stored, when it does not the
// scheduled times stand as the final times, and the completion draft
// is prepared from the (final) window.
export function setMaintenanceWindowStatus(list, id, targetStatus, finalTimes = {}) {
  const current = normalizeMaintenanceWindows(list);
  const index = current.findIndex((item) => item.id === text(id));
  if (index < 0) return list;
  const window = current[index];
  const target = normalizeStatus(targetStatus);
  if (target === null || !(STATUS_TRANSITIONS[window.status] ?? []).includes(target)) return list;
  const finalDate = text(finalTimes.date);
  const finalStartTime = text(finalTimes.startTime ?? finalTimes.start);
  const finalEndTime = text(finalTimes.endTime ?? finalTimes.end);
  if (finalDate && !isValidMaintenanceDate(finalDate)) return list;
  if (finalStartTime && !isValidMaintenanceTime(finalStartTime)) return list;
  if (finalEndTime && !isValidMaintenanceTime(finalEndTime)) return list;
  if (finalStartTime && finalEndTime && finalEndTime <= finalStartTime) return list;
  const next = { ...window, status: target };
  if (target === MAINTENANCE_STATUSES.COMPLETED) {
    next.finalDate = finalDate || window.date;
    next.finalStartTime = finalStartTime || window.startTime;
    next.finalEndTime = finalEndTime || window.endTime;
    const draft = buildMaintenanceAnnouncement(next, {});
    next.announcementDraft = draft.text;
  }
  const out = current.slice();
  out[index] = next;
  return out;
}

export function windowsByStatus(list, status) {
  const target = normalizeStatus(status);
  if (target === null) return [];
  return sortMaintenanceWindows(list).filter((item) => item.status === target);
}

export function completedMaintenanceWindows(list) {
  return windowsByStatus(list, MAINTENANCE_STATUSES.COMPLETED);
}

// The segment (splitter) serving one customer, from the caller's
// connection records (last record per customer wins, the Plan 17
// rule) or from the customer's own splitter fields when no register
// row exists. Returns the trimmed splitter name, or null.
function segmentForCustomer(customer, connections) {
  const id = text(customer?.id ?? customer?.customerId);
  if (!id) return null;
  if (Array.isArray(connections)) {
    let found = null;
    for (const record of connections) {
      if (!record || typeof record !== 'object') continue;
      const recordId = text(record.customerId ?? record.id);
      const splitter = text(record.splitter ?? record.splitterId ?? record.splitterBoxId ?? record.box);
      if (recordId === id && splitter) found = splitter;
    }
    if (found) return found;
  }
  return text(customer.splitter ?? customer.splitterId ?? customer.splitterBoxId ?? customer.box) || null;
}

// Exactly the customers a window affects, on the same fixture: a
// customer matches when its canonical mohalla is one of the
// window's mohallas, or its segment is one of the window's
// segments. Archived customers are listed separately, never silently
// dropped, and never counted as affected. A customer with no
// mohalla and no segment is never assigned to a window.
export function affectedMaintenanceCustomers(window, { customers, connections } = {}) {
  const normalized = normalizeMaintenanceWindow(window);
  if (!normalized) return { customers: [], archivedCustomers: [], totalCustomers: 0, affectedCount: 0 };
  const mohallaKeys = new Set(resolveMohallas(normalized.mohallas).map((m) => m.key));
  const segmentKeys = new Set(resolveSegments(normalized.segments).map((s) => s.key));
  const affected = [];
  const archived = [];
  let total = 0;
  for (const customer of Array.isArray(customers) ? customers : []) {
    if (!customer || typeof customer !== 'object') continue;
    total += 1;
    const canon = canonicalMaintenanceMohalla(customer.mohalla ?? customer.area ?? '');
    const segment = segmentForCustomer(customer, connections);
    const byMohalla = canon !== null && mohallaKeys.has(canon.key);
    const bySegment = segment !== null && segmentKeys.has(segment.toLowerCase());
    if (!byMohalla && !bySegment) continue;
    const row = {
      customerId: text(customer.id ?? customer.customerId),
      customerName: text(customer.customerName ?? customer.name) || text(customer.id ?? customer.customerId),
      mohallaLabel: canon ? canon.label : null,
      segment: segment || null,
      matchedBy: byMohalla && bySegment ? 'mohalla and segment' : byMohalla ? 'mohalla' : 'segment',
      archived: customer.archived === true,
    };
    if (row.archived) archived.push(row);
    else affected.push(row);
  }
  const byName = (a, b) => (a.customerName.toLowerCase() < b.customerName.toLowerCase() ? -1
    : a.customerName.toLowerCase() > b.customerName.toLowerCase() ? 1
    : a.customerId < b.customerId ? -1 : a.customerId > b.customerId ? 1 : 0);
  affected.sort(byName);
  archived.sort(byName);
  return { customers: affected, archivedCustomers: archived, totalCustomers: total, affectedCount: affected.length };
}

function formatScope(window, variant) {
  const mohallaLabels = resolveMohallas(window.mohallas).map((m) => m.label);
  const segmentLabels = resolveSegments(window.segments).map((s) => s.label);
  const parts = [];
  if (mohallaLabels.length > 0) parts.push(mohallaLabels.join(variant === 'urdu' ? '، ' : ', '));
  if (segmentLabels.length > 0) parts.push(`segment${segmentLabels.length === 1 ? '' : 's'} ${segmentLabels.join(', ')}`);
  return parts.join(variant === 'urdu' ? ' اور ' : ' and ');
}

// The completion announcement for one window, in Roman Urdu or Urdu
// script. It names the final times when the window is completed and
// the scheduled times otherwise, the affected mohallas/segments,
// and the work description verbatim — and promises no return time
// beyond the window itself. Returns null when the window is invalid
// or addresses nothing.
export function buildMaintenanceAnnouncement(window, { variant } = {}) {
  const normalized = normalizeMaintenanceWindow(window);
  if (!normalized) return null;
  const scope = formatScope(normalized, variant === 'urdu' ? 'urdu' : 'roman');
  if (!scope) return null;
  const date = normalized.status === MAINTENANCE_STATUSES.COMPLETED && normalized.finalDate
    ? normalized.finalDate : normalized.date;
  const start = normalized.status === MAINTENANCE_STATUSES.COMPLETED && normalized.finalStartTime
    ? normalized.finalStartTime : normalized.startTime;
  const end = normalized.status === MAINTENANCE_STATUSES.COMPLETED && normalized.finalEndTime
    ? normalized.finalEndTime : normalized.endTime;
  if (variant === 'urdu') {
    return {
      variant: 'urdu',
      text: `السلام علیکم، شاہدرہ فائبر نیٹ کی طرف سے اطلاع: پلانڈ مینٹیننس کا کام ${scope} میں ${date} کو ${start} سے ${end} تک ہوا۔ کام: ${normalized.description}۔ اس دوران سروس میں خلل آ سکتا تھا۔ شکریہ — شاہدرہ فائبر نیٹ۔`,
    };
  }
  return {
    variant: 'roman',
    text: `Assalam-o-Alaikum, Shahdara Fiber Net ki taraf se ittila: planned maintenance ka kaam ${scope} mein ${date} ko ${start} se ${end} tak hua. Kaam: ${normalized.description}. Is doran service mein khalal aa sakta tha. Shukriya — Shahdara Fiber Net.`,
  };
}

// The WhatsApp route for a completion draft: a window has no single
// phone number, so the draft opens with no recipient and the
// operator picks the recipients in WhatsApp.
export function maintenanceWhatsAppUrl(draftText) {
  const value = text(draftText);
  return value ? `https://wa.me/?text=${encodeURIComponent(value)}` : 'https://wa.me/';
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch]));
}

function csvCell(value) {
  const str = String(value ?? '');
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

const STATUS_LABELS = { scheduled: 'Scheduled', in_progress: 'In progress', completed: 'Completed', postponed: 'Postponed' };

export function maintenanceSummaryText(list) {
  const windows = sortMaintenanceWindows(list);
  if (windows.length === 0) return 'No maintenance windows scheduled yet.';
  const counts = { scheduled: 0, in_progress: 0, completed: 0, postponed: 0 };
  for (const window of windows) counts[window.status] += 1;
  const next = windows.find((window) => window.status === 'scheduled' || window.status === 'in_progress');
  const nextPart = next ? ` Next: ${next.date} ${next.startTime}–${next.endTime}, ${next.description}.` : '';
  return `${windows.length} window${windows.length === 1 ? '' : 's'}: ${counts.scheduled} scheduled, ${counts.in_progress} in progress, ${counts.completed} completed, ${counts.postponed} postponed.${nextPart}`;
}

export function maintenanceWindowsHtml(list, affectedById = {}) {
  const windows = sortMaintenanceWindows(list);
  if (windows.length === 0) return '<p class="empty-state">No maintenance windows scheduled yet.</p>';
  const rows = windows.map((window) => {
    const affected = affectedById[window.id];
    const affectedNote = affected ? ` (${affected.affectedCount} customer${affected.affectedCount === 1 ? '' : 's'} affected)` : '';
    const finalNote = window.status === 'completed'
      ? `<br><small>Final times: ${escapeHtml(window.finalDate || window.date)} ${escapeHtml(window.finalStartTime || window.startTime)}–${escapeHtml(window.finalEndTime || window.endTime)}</small>`
      : '';
    const draftNote = window.announcementDraft ? `<br><small>Announcement draft ready.</small> <button class="secondary-button btn-sm maintenance-announce-btn" type="button" data-maintenance-announce="${escapeHtml(window.id)}">📲 Send announcement via WhatsApp</button>` : '';
    const buttons = window.status === 'completed' ? ''
      : `<button class="secondary-button btn-sm maintenance-start-btn" type="button" data-maintenance-start="${escapeHtml(window.id)}">Start</button> <button class="secondary-button btn-sm maintenance-complete-btn" type="button" data-maintenance-complete="${escapeHtml(window.id)}">Complete</button> <button class="secondary-button btn-sm maintenance-postpone-btn" type="button" data-maintenance-postpone="${escapeHtml(window.id)}">Postpone</button>${window.status === 'postponed' ? ` <button class="secondary-button btn-sm maintenance-reschedule-btn" type="button" data-maintenance-reschedule="${escapeHtml(window.id)}">Back to scheduled</button>` : ''} <button class="secondary-button btn-sm maintenance-remove-btn" type="button" data-maintenance-remove="${escapeHtml(window.id)}">Remove</button>`;
    return `<tr><td><strong>${escapeHtml(window.date)} ${escapeHtml(window.startTime)}–${escapeHtml(window.endTime)}</strong>${finalNote}<br><small>${escapeHtml(window.description)}</small><br><small>Mohallas: ${escapeHtml(resolveMohallas(window.mohallas).map((m) => m.label).join(', ') || '—')}; Segments: ${escapeHtml(resolveSegments(window.segments).map((s) => s.label).join(', ') || '—')}${affectedNote}</small>${draftNote}</td><td>${escapeHtml(STATUS_LABELS[window.status])}</td><td>${buttons}</td></tr>`;
  }).join('');
  return `<table class="maintenance-calendar-table"><thead><tr><th>Window</th><th>Status</th><th>Actions</th></tr></thead><tbody>${rows}</tbody></table>`;
}

export function maintenanceWindowsCsv(list, affectedById = {}) {
  const windows = sortMaintenanceWindows(list);
  const header = 'id,date,start_time,end_time,description,status,mohallas,segments,affected_customers,final_date,final_start_time,final_end_time';
  const lines = windows.map((window) => [
    window.id, window.date, window.startTime, window.endTime, window.description, window.status,
    resolveMohallas(window.mohallas).map((m) => m.label).join('; '),
    resolveSegments(window.segments).map((s) => s.label).join('; '),
    affectedById[window.id]?.affectedCount ?? '',
    window.finalDate ?? '', window.finalStartTime ?? '', window.finalEndTime ?? '',
  ].map(csvCell).join(','));
  return [header, ...lines].join('\n');
}

export function maintenanceCalendarFilename(today) {
  const day = typeof today === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(today) ? today : 'unknown-date';
  return `maintenance-calendar-${day}.csv`;
}
