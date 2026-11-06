// Operator note pinning (Plan 337): one pin record per pinned note, so a
// standing warning or reminder stays at the top of the list instead of
// sinking under newer notes. A pin carries the note reference, who pinned
// it, the date pinned, and — once unpinned — the unpin date or the
// reason. Pinning only changes display order, never note content: the
// module only orders plain-words note references supplied by the caller
// and never reads, writes, or changes any note, bill, payment, or
// customer record by itself. A pin is active while it has no unpin date
// and no unpin reason. Unpinning removes the pin and leaves the note
// intact. Inputs are never mutated, and the module never reads storage,
// the clock, the network, or the page.

const OPERATOR_NOTE_PIN_DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function isOperatorNotePinLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function validOperatorNotePinDay(value) {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12) return false;
  let lastDay = OPERATOR_NOTE_PIN_DAYS_IN_MONTH[month - 1];
  if (month === 2 && isOperatorNotePinLeapYear(year)) lastDay = 29;
  return day >= 1 && day <= lastDay;
}

function cleanOperatorNotePinText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function normalizeOperatorNotePin(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const id = cleanOperatorNotePinText(raw.id);
  const noteRef = cleanOperatorNotePinText(raw.noteRef);
  const pinnedBy = cleanOperatorNotePinText(raw.pinnedBy);
  const datePinned = cleanOperatorNotePinText(raw.datePinned);
  if (!id || !noteRef || !pinnedBy || !validOperatorNotePinDay(datePinned)) return null;
  const unpinDate = cleanOperatorNotePinText(raw.unpinDate);
  const unpinReason = cleanOperatorNotePinText(raw.unpinReason);
  return {
    id,
    noteRef,
    pinnedBy,
    datePinned,
    unpinDate: validOperatorNotePinDay(unpinDate) ? unpinDate : '',
    unpinReason,
  };
}

export function normalizeOperatorNotePinList(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of list) {
    const pin = normalizeOperatorNotePin(raw);
    if (pin && !seen.has(pin.id)) {
      seen.add(pin.id);
      out.push(pin);
    }
  }
  return out;
}

export function isOperatorNotePinActive(pin) {
  const clean = normalizeOperatorNotePin(pin);
  if (!clean) return false;
  return !clean.unpinDate && !clean.unpinReason;
}

export function findOperatorNotePin(list, noteRef) {
  const clean = normalizeOperatorNotePinList(list);
  const wanted = cleanOperatorNotePinText(noteRef);
  if (!wanted) return null;
  return clean.find((pin) => pin.noteRef.toLowerCase() === wanted.toLowerCase() && isOperatorNotePinActive(pin)) || null;
}

export function recordOperatorNotePin(list, pin) {
  const clean = normalizeOperatorNotePinList(list);
  const next = normalizeOperatorNotePin(pin);
  if (!next) return clean;
  if (clean.some((item) => item.id === next.id)) return clean;
  if (findOperatorNotePin(clean, next.noteRef)) return clean;
  return [...clean, next];
}

export function unpinOperatorNotePin(list, noteRef, details) {
  const clean = normalizeOperatorNotePinList(list);
  const wanted = cleanOperatorNotePinText(noteRef);
  if (!wanted) return clean;
  const unpinDate = details && typeof details === 'object' ? cleanOperatorNotePinText(details.unpinDate) : '';
  const unpinReason = details && typeof details === 'object' ? cleanOperatorNotePinText(details.unpinReason) : '';
  if (!validOperatorNotePinDay(unpinDate) && !unpinReason) return clean;
  const at = clean.findIndex((pin) => pin.noteRef.toLowerCase() === wanted.toLowerCase() && isOperatorNotePinActive(pin));
  if (at < 0) return clean;
  const out = [...clean];
  out[at] = {
    ...clean[at],
    unpinDate: validOperatorNotePinDay(unpinDate) ? unpinDate : '',
    unpinReason,
  };
  return out;
}

function compareOperatorNotePins(a, b) {
  if (a.datePinned !== b.datePinned) return a.datePinned < b.datePinned ? -1 : 1;
  if (a.id !== b.id) return a.id < b.id ? -1 : 1;
  return 0;
}

export function activeOperatorNotePins(list) {
  return normalizeOperatorNotePinList(list)
    .filter((pin) => isOperatorNotePinActive(pin))
    .sort(compareOperatorNotePins);
}

function operatorNotePinNoteList(values) {
  if (!Array.isArray(values)) return [];
  const seen = new Map();
  for (const value of values) {
    const noteRef = cleanOperatorNotePinText(value);
    if (!noteRef) continue;
    const key = noteRef.toLowerCase();
    if (!seen.has(key)) seen.set(key, noteRef);
  }
  return [...seen.values()];
}

export function operatorNotePinsInDisplayOrder(list, notes = []) {
  const pins = activeOperatorNotePins(list);
  const wanted = operatorNotePinNoteList(notes);
  const pinned = [];
  const pinnedKeys = new Set();
  for (const pin of pins) {
    const key = pin.noteRef.toLowerCase();
    const match = wanted.find((noteRef) => noteRef.toLowerCase() === key);
    if (!match) continue;
    pinned.push({ noteRef: match, pinned: true, pinnedBy: pin.pinnedBy, datePinned: pin.datePinned });
    pinnedKeys.add(key);
  }
  const rest = wanted
    .filter((noteRef) => !pinnedKeys.has(noteRef.toLowerCase()))
    .map((noteRef) => ({ noteRef, pinned: false, pinnedBy: '', datePinned: '' }));
  return [...pinned, ...rest];
}

export function operatorNotePinSummaryText(list) {
  const clean = normalizeOperatorNotePinList(list);
  if (!clean.length) return 'No notes pinned.';
  const active = activeOperatorNotePins(clean);
  const unpinned = clean.length - active.length;
  const activeText = `${active.length} pinned note${active.length === 1 ? '' : 's'}`;
  if (!unpinned) return `${activeText}.`;
  return `${activeText}, ${unpinned} unpinned.`;
}

export function operatorNotePinText(pin) {
  const clean = normalizeOperatorNotePin(pin);
  if (!clean) return '';
  return `${clean.noteRef} — ${operatorNotePinDetailText(clean)}`;
}

function escapeOperatorNotePinHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function operatorNotePinDetailText(pin) {
  const clean = normalizeOperatorNotePin(pin);
  if (!clean) return '';
  if (isOperatorNotePinActive(clean)) {
    return `pinned by ${clean.pinnedBy} on ${clean.datePinned}`;
  }
  const when = clean.unpinDate ? ` on ${clean.unpinDate}` : '';
  const why = clean.unpinReason ? ` (${clean.unpinReason})` : '';
  return `pinned by ${clean.pinnedBy} on ${clean.datePinned}, unpinned${when}${why}`;
}

export function operatorNotePinHtml(pin) {
  const clean = normalizeOperatorNotePin(pin);
  if (!clean) return '';
  return `<div><strong>${escapeOperatorNotePinHtml(clean.noteRef)}</strong> — ${escapeOperatorNotePinHtml(operatorNotePinDetailText(clean))}</div>`;
}

export function operatorNotePinsHtml(list) {
  const clean = normalizeOperatorNotePinList(list);
  if (!clean.length) return '<p>No notes pinned.</p>';
  const items = [...clean].sort(compareOperatorNotePins).map((pin) => `<li>${escapeOperatorNotePinHtml(operatorNotePinText(pin))}</li>`).join('');
  return `<ul>${items}</ul>`;
}

export function activeOperatorNotePinsHtml(list) {
  const active = activeOperatorNotePins(list);
  if (!active.length) return '<p>No pinned notes.</p>';
  const items = active.map((pin) => `<li>${escapeOperatorNotePinHtml(operatorNotePinText(pin))}</li>`).join('');
  return `<ul>${items}</ul>`;
}

export function operatorNotePinsInDisplayOrderHtml(list, notes = []) {
  const ordered = operatorNotePinsInDisplayOrder(list, notes);
  if (!ordered.length) return '<p>No notes listed.</p>';
  const items = ordered.map((item) => {
    const label = item.pinned ? ` (pinned by ${item.pinnedBy} on ${item.datePinned})` : '';
    return `<li>${escapeOperatorNotePinHtml(item.noteRef)}${escapeOperatorNotePinHtml(label)}</li>`;
  }).join('');
  return `<ul>${items}</ul>`;
}

function operatorNotePinCsvCell(value) {
  const text = String(value ?? '');
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function operatorNotePinCsv(list) {
  const clean = normalizeOperatorNotePinList(list);
  const header = ['id', 'noteRef', 'pinnedBy', 'datePinned', 'unpinDate', 'unpinReason'];
  const lines = [header.map(operatorNotePinCsvCell).join(',')];
  for (const pin of clean) {
    lines.push([
      pin.id,
      pin.noteRef,
      pin.pinnedBy,
      pin.datePinned,
      pin.unpinDate,
      pin.unpinReason,
    ].map(operatorNotePinCsvCell).join(','));
  }
  return lines.join('\n');
}

export function operatorNotePinFilename() {
  return 'operator-note-pins.csv';
}
