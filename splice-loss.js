// Plan 232 (Plan 203-350) — Splice loss note per joint.
//
// When a splice is redone, nobody knows what loss the joint showed
// before, so a marginal joint keeps being reworked without any trend
// to judge it by. This module adds only the missing piece: one loss
// note per reading for a joint — the joint reference, the date, the
// loss reading exactly as the technician entered it, an instrument
// note if any, and the technician.
//
// One loss note: the id, the joint reference, a strict calendar date,
// the loss reading as entered, the instrument note, and the
// technician.
//
// The fences, stated plainly:
//   - This records readings only. It does not replace the splice and
//     joint repair record (Plan 145), which records the repair
//     itself: that module is neither read nor rewritten here, and
//     this module imports nothing.
//   - A note is never edited, only followed by a newer note. There
//     is no edit function: only record and remove. A newer note
//     never rewrites an earlier note.
//   - Loss notes for one joint list in date order and show the
//     latest reading alongside earlier ones, so the trend is visible
//     at a glance.
//   - Recording a loss note never changes any bill, payment,
//     customer, fault, or repair record by itself: the module takes
//     no bill, payment, customer, fault, or repair object in, edits
//     none, and returns none. It holds loss notes only.
//   - Inputs are never mutated, and the module never reads storage,
//     the clock, the network, or the page.

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function validSpliceLossDate(value) {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1) return false;
  let limit = DAYS_IN_MONTH[month - 1];
  if (month === 2 && isLeapYear(year)) limit = 29;
  return day <= limit;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function cleanNote(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = text(raw.id);
  const jointRef = text(raw.jointRef);
  const date = text(raw.date);
  const loss = text(raw.loss);
  if (!id || !jointRef || !validSpliceLossDate(date) || !loss) return null;
  return {
    id,
    jointRef,
    date,
    loss,
    instrument: text(raw.instrument),
    technician: text(raw.technician),
  };
}

export function normalizeSpliceLossList(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of list) {
    const note = cleanNote(raw);
    if (!note) continue;
    if (seen.has(note.id)) continue;
    seen.add(note.id);
    out.push(note);
  }
  return out;
}

export function recordSpliceLoss(list, raw) {
  const base = normalizeSpliceLossList(list);
  const note = cleanNote(raw);
  if (!note) return null;
  if (base.some((item) => item.id === note.id)) return null;
  return [...base, note];
}

export function removeSpliceLoss(list, id) {
  const base = normalizeSpliceLossList(list);
  const wanted = text(id);
  if (!wanted) return base;
  return base.filter((item) => item.id !== wanted);
}

export function findSpliceLoss(list, id) {
  const wanted = text(id);
  if (!wanted) return null;
  return normalizeSpliceLossList(list).find((item) => item.id === wanted) ?? null;
}

function byJointThenDate(a, b) {
  if (a.jointRef < b.jointRef) return -1;
  if (a.jointRef > b.jointRef) return 1;
  if (a.date < b.date) return -1;
  if (a.date > b.date) return 1;
  if (a.id < b.id) return -1;
  if (a.id > b.id) return 1;
  return 0;
}

export function spliceLossSorted(list) {
  return normalizeSpliceLossList(list).slice().sort(byJointThenDate);
}

export function spliceLossForJoint(list, jointRef) {
  const wanted = text(jointRef);
  if (!wanted) return [];
  return spliceLossSorted(list).filter((item) => item.jointRef === wanted);
}

export function spliceLossLatest(list, jointRef) {
  const notes = spliceLossForJoint(list, jointRef);
  return notes.length ? notes[notes.length - 1] : null;
}

export function spliceLossJoints(list) {
  const joints = [];
  for (const note of normalizeSpliceLossList(list)) {
    if (!joints.includes(note.jointRef)) joints.push(note.jointRef);
  }
  return joints.sort();
}

export function spliceLossSummaryText(list) {
  const notes = normalizeSpliceLossList(list);
  const joints = spliceLossJoints(list);
  if (!notes.length) return 'No splice loss notes recorded.';
  return `${notes.length} loss note${notes.length === 1 ? '' : 's'} across ${joints.length} joint${joints.length === 1 ? '' : 's'}.`;
}

export function spliceLossText(note) {
  if (!note) return '';
  const clean = cleanNote(note);
  if (!clean) return '';
  const instrument = clean.instrument || 'No instrument noted';
  const technician = clean.technician || 'No technician noted';
  return `${clean.jointRef} — ${clean.date} — loss ${clean.loss} — ${instrument} — ${technician}.`;
}

export function spliceLossJointText(list, jointRef) {
  const notes = spliceLossForJoint(list, jointRef);
  if (!notes.length) return `No loss notes for ${text(jointRef)}.`;
  const latest = notes[notes.length - 1];
  const earlier = notes.slice(0, -1);
  let out = `Joint ${latest.jointRef} — latest reading: ${latest.loss} on ${latest.date}.`;
  if (earlier.length) {
    out += ` Earlier readings: ${earlier.map((note) => `${note.loss} on ${note.date}`).join('; ')}.`;
  }
  return out;
}

export function spliceLossHtml(note) {
  const clean = cleanNote(note);
  if (!clean) return '';
  return `<p>${escapeHtml(spliceLossText(clean))}</p>`;
}

function csvCell(value) {
  const cell = String(value ?? '');
  return /[",\n]/.test(cell) ? `"${cell.replaceAll('"', '""')}"` : cell;
}

export function spliceLossCsv(list) {
  const rows = [['id', 'jointRef', 'date', 'loss', 'instrument', 'technician']];
  for (const note of spliceLossSorted(list)) {
    rows.push([note.id, note.jointRef, note.date, note.loss, note.instrument, note.technician]);
  }
  return rows.map((row) => row.map(csvCell).join(',')).join('\n');
}

export function spliceLossFilename() {
  return 'splice-loss-notes.csv';
}
