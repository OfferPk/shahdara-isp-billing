// Plan 251 (Plan 203-350) — Field training note per technician.
//
// Field skills are learned on the job — splicing, pole work, ONU
// setup — but there was no record of who has practised what, so a
// technician could be sent to a job they had never done. This module
// adds only the missing piece: one training note per technician per
// field skill — the technician, the skill in plain words, the date
// practised or observed, who observed it, and a note.
//
// The fences, stated plainly:
//   - This covers field skills only, not general staff training
//     records. It does not replace the new collector onboarding
//     checklist, which covers collector onboarding steps: no
//     onboarding record is read nor rewritten here, and this
//     module imports nothing.
//   - A technician with no note for a skill is plainly shown as
//     unrecorded for that skill, never as trained, so the owner
//     can match the right person to each job across 11 mohallas.
//   - A note is never edited, only followed by newer notes: there
//     is no edit function, only record, annotate, and remove. A
//     dated follow-up note never rewrites the technician, the
//     skill, the date practised or observed, who observed it, or
//     the note.
//   - Recording training never changes any bill, payment, customer,
//     visit, or staff record by itself: the module takes no bill,
//     payment, customer, visit, or staff object in, edits none,
//     and returns none. It holds field training notes only.
//   - Inputs are never mutated, and the module never reads
//     storage, the clock, the network, or the page.

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export const FIELD_TRAINING_STORE = 'shahdara_field_training_v1';
export const FIELD_TRAINING_FILENAME = 'field-training-notes.csv';

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function validFieldTrainingDate(value) {
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

function cleanFollowUps(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const date = text(item.date);
    const note = text(item.note);
    if (!validFieldTrainingDate(date) || !note) continue;
    out.push({ date, note });
  }
  return out;
}

function normalizeEntry(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const id = text(entry.id);
  const technician = text(entry.technician);
  const skill = text(entry.skill);
  const date = text(entry.date);
  const observedBy = text(entry.observedBy);
  const note = text(entry.note);
  if (!id || !technician || !skill || !date || !observedBy || !note) return null;
  if (!validFieldTrainingDate(date)) return null;
  return {
    id,
    technician,
    skill,
    date,
    observedBy,
    note,
    followUps: cleanFollowUps(entry.followUps),
  };
}

export function normalizeFieldTrainingList(list) {
  if (!Array.isArray(list)) return [];
  const seenIds = new Set();
  const out = [];
  for (const entry of list) {
    const clean = normalizeEntry(entry);
    if (!clean) continue;
    if (seenIds.has(clean.id)) continue;
    seenIds.add(clean.id);
    out.push(clean);
  }
  return out;
}

// One note per technician per skill: a second note for the same
// technician and skill (case-insensitive) is refused, so the
// record stays one note per pair and newer notes arrive only as
// dated follow-ups on that note.
export function recordFieldTraining(list, entry) {
  const clean = normalizeEntry(entry);
  if (!clean) return null;
  const base = normalizeFieldTrainingList(list);
  if (base.some((item) => item.id === clean.id)) return base;
  if (
    base.some(
      (item) =>
        item.technician.toLowerCase() === clean.technician.toLowerCase() &&
        item.skill.toLowerCase() === clean.skill.toLowerCase(),
    )
  ) {
    return base;
  }
  return [...base, clean];
}

export function removeFieldTraining(list, id) {
  const base = normalizeFieldTrainingList(list);
  return base.filter((item) => item.id !== text(id));
}

export function findFieldTraining(list, id) {
  const base = normalizeFieldTrainingList(list);
  return base.find((item) => item.id === text(id)) || null;
}

// A follow-up is a dated note added after the training, never a
// rewrite: the technician, the skill, the date practised or
// observed, who observed it, and the note all stay exactly as
// recorded.
export function annotateFieldTraining(list, id, followUp) {
  const base = normalizeFieldTrainingList(list);
  const target = text(id);
  if (!followUp || typeof followUp !== 'object') return list;
  const date = text(followUp.date);
  const note = text(followUp.note);
  if (!validFieldTrainingDate(date) || !note) return list;
  if (!base.some((item) => item.id === target)) return list;
  return base.map((item) =>
    item.id === target
      ? { ...item, followUps: [...item.followUps, { date, note }] }
      : item,
  );
}

export function fieldTrainingSorted(list) {
  const base = normalizeFieldTrainingList(list);
  return [...base].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    const byTechnician = a.technician
      .toLowerCase()
      .localeCompare(b.technician.toLowerCase());
    if (byTechnician !== 0) return byTechnician;
    const bySkill = a.skill.toLowerCase().localeCompare(b.skill.toLowerCase());
    if (bySkill !== 0) return bySkill;
    return a.id.localeCompare(b.id);
  });
}

export function fieldTrainingForTechnician(list, technician) {
  const wanted = text(technician).toLowerCase();
  return fieldTrainingSorted(list).filter(
    (item) => item.technician.toLowerCase() === wanted,
  );
}

export function fieldTrainingTechnicians(list) {
  const base = normalizeFieldTrainingList(list);
  const seen = new Set();
  const out = [];
  for (const item of base) {
    const key = item.technician.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item.technician);
  }
  return out;
}

// Skills list per technician with dates, one line per skill,
// in skill order (A-Z, case-insensitive, first spelling kept).
export function fieldTrainingSkillsForTechnician(list, technician) {
  const rows = fieldTrainingForTechnician(list, technician);
  const seen = new Set();
  const out = [];
  for (const item of rows) {
    const key = item.skill.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      skill: item.skill,
      date: item.date,
      observedBy: item.observedBy,
      noteId: item.id,
    });
  }
  return out.sort((a, b) =>
    a.skill.toLowerCase().localeCompare(b.skill.toLowerCase()),
  );
}

// A technician with no note for a skill is plainly shown as
// unrecorded for that skill, never as trained.
export function technicianSkillStatus(list, technician, skill) {
  const wantedSkill = text(skill).toLowerCase();
  const rows = fieldTrainingForTechnician(list, technician);
  const found = rows.find((item) => item.skill.toLowerCase() === wantedSkill);
  if (!found) {
    return { status: 'unrecorded', date: null, observedBy: null, noteId: null };
  }
  return {
    status: 'recorded',
    date: found.date,
    observedBy: found.observedBy,
    noteId: found.id,
  };
}

export function unrecordedFieldSkills(list, technician, skills) {
  if (!Array.isArray(skills)) return [];
  const out = [];
  for (const skill of skills) {
    const name = text(skill);
    if (!name) continue;
    if (technicianSkillStatus(list, technician, name).status === 'unrecorded') {
      out.push(name);
    }
  }
  return out;
}

export function fieldTrainingSummaryText(list) {
  const base = normalizeFieldTrainingList(list);
  const technicians = fieldTrainingTechnicians(list);
  const noteWord = base.length === 1 ? 'note' : 'notes';
  const technicianWord = technicians.length === 1 ? 'technician' : 'technicians';
  if (base.length === 0) return 'No field training notes recorded.';
  return (
    `${base.length} training ${noteWord} for ${technicians.length} ${technicianWord}. ` +
    `A skill with no note is unrecorded, never trained.`
  );
}

export function fieldTrainingText(entry) {
  const clean = normalizeEntry(entry);
  if (!clean) return '';
  const followUps =
    clean.followUps.length === 0
      ? 'No dated follow-up notes yet.'
      : `${clean.followUps.length} dated follow-up note${clean.followUps.length === 1 ? '' : 's'}, latest ${clean.followUps[clean.followUps.length - 1].date}.`;
  const noteText = clean.note.endsWith('.') ? clean.note : `${clean.note}.`;
  return (
    `${clean.technician} practised ${clean.skill} on ${clean.date}, ` +
    `observed by ${clean.observedBy}. ${noteText} ${followUps}`
  );
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function fieldTrainingHtml(list) {
  const rows = fieldTrainingSorted(list);
  if (rows.length === 0) return '<p>No field training notes recorded.</p>';
  const items = rows
    .map((item) => `<li>${escapeHtml(fieldTrainingText(item))}</li>`)
    .join('');
  return `<ul>${items}</ul>`;
}

function csvCell(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

export function fieldTrainingCsv(list) {
  const rows = fieldTrainingSorted(list);
  const header = [
    'id',
    'technician',
    'skill',
    'date',
    'observed by',
    'note',
    'dated follow-up notes',
  ]
    .map(csvCell)
    .join(',');
  const lines = rows.map((item) =>
    [
      item.id,
      item.technician,
      item.skill,
      item.date,
      item.observedBy,
      item.note,
      item.followUps.map((a) => `${a.date}: ${a.note}`).join(' | '),
    ]
      .map(csvCell)
      .join(','),
  );
  return [header, ...lines].join('\n');
}

export function fieldTrainingFilename() {
  return FIELD_TRAINING_FILENAME;
}
