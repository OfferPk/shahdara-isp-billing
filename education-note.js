// Plan 169 (Plan 101-202) — Customer Education Notes as Operator-Shared Drafts.
//
// The same simple guidance — how to restart an ONU, what a blinking
// light means, when to call instead of resetting — is explained from
// scratch on every visit and forgotten afterwards. This module keeps
// a small library of short education notes, each with a title,
// plain-words steps, and an applies-when line, kept as drafts the
// operator shares by hand with a customer (printed or read out).
//
// What this module is NOT, stated plainly:
//   - It is not the operator help guide (help-guide.js). That guide
//     explains the app's own features to the operator through a
//     popup. These notes are generic customer guidance, shared with
//     customers by hand; help-guide.js is neither read nor written.
//   - Notes are generic guidance only and are never tied to a fault
//     diagnosis for a specific customer. A note carries no customer
//     data at all; only the share record names a customer.
//   - Sharing a note records only that it was shared, with a date
//     and a customer id. It never changes any other record, never
//     diagnoses a fault, and never sends anything automatically.
//     Marking a note shared only records that the operator shared
//     it; the sharing itself happened by hand, outside this module.
//   - It is not proof that the guidance is right. Titles, steps,
//     and applies-when lines are exactly what the operator typed;
//     the module verifies format and ordering, not truth.
//
// How the module keeps those fences:
//   - It is pure and import-free: the caller supplies every record
//     and the module never reads storage, the clock, or the network,
//     and never touches another record.
//   - A note with no id, no title, no steps, or no applies-when
//     line is refused outright. A share record with no id, no note
//     id, no customer id, or no date is refused outright, as is a
//     share naming a note that is not in the library. Unknown
//     fields are dropped, so a note or a share can never grow a
//     field belonging to another record type.
//   - A duplicate id is never rewritten: an identical re-save
//     leaves the list unchanged, and a re-save with different
//     figures also leaves the list unchanged.
//   - To change a note the operator removes the old one and records
//     a new one. There is no edit function.

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function isLeapYear(year) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function isStrictDate(value) {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12) return false;
  let limit = DAYS_IN_MONTH[month - 1];
  if (month === 2 && isLeapYear(year)) limit = 29;
  return day >= 1 && day <= limit;
}

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeSteps(value) {
  const raw = Array.isArray(value) ? value : typeof value === 'string' ? value.split('\n') : [];
  return raw.map((line) => cleanText(line)).filter(Boolean);
}

export function normalizeEducationNote(note) {
  if (!note || typeof note !== 'object') return null;
  const id = cleanText(note.id);
  const title = cleanText(note.title);
  const steps = normalizeSteps(note.steps);
  const appliesWhen = cleanText(note.appliesWhen);
  if (!id || !title || steps.length === 0 || !appliesWhen) return null;
  return { id, title, steps, appliesWhen };
}

export function normalizeEducationNoteList(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  const seen = new Set();
  for (const item of list) {
    const clean = normalizeEducationNote(item);
    if (clean && !seen.has(clean.id)) {
      seen.add(clean.id);
      out.push(clean);
    }
  }
  return out;
}

export function findEducationNote(list, id) {
  const clean = normalizeEducationNoteList(list);
  return clean.find((note) => note.id === cleanText(id)) || null;
}

export function upsertEducationNote(list, note) {
  const cleanList = normalizeEducationNoteList(list);
  const clean = normalizeEducationNote(note);
  if (!clean) return cleanList;
  if (cleanList.some((item) => item.id === clean.id)) return cleanList;
  return [...cleanList, clean];
}

export function removeEducationNote(list, id) {
  const cleanList = normalizeEducationNoteList(list);
  const target = cleanText(id);
  if (!target) return cleanList;
  return cleanList.filter((item) => item.id !== target);
}

export function normalizeEducationShare(share) {
  if (!share || typeof share !== 'object') return null;
  const id = cleanText(share.id);
  const noteId = cleanText(share.noteId);
  const customerId = cleanText(share.customerId);
  const sharedDate = cleanText(share.sharedDate);
  if (!id || !noteId || !customerId || !sharedDate || !isStrictDate(sharedDate)) return null;
  return { id, noteId, customerId, sharedDate };
}

export function normalizeEducationShareList(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  const seen = new Set();
  for (const item of list) {
    const clean = normalizeEducationShare(item);
    if (clean && !seen.has(clean.id)) {
      seen.add(clean.id);
      out.push(clean);
    }
  }
  return out;
}

// Sharing records only that the note was shared, with a date and a
// customer id. A share naming a note that is not in the library is
// refused, so a share can never point at a note that does not exist.
export function recordEducationShare(notes, shares, share) {
  const cleanNotes = normalizeEducationNoteList(notes);
  const cleanShares = normalizeEducationShareList(shares);
  const clean = normalizeEducationShare(share);
  if (!clean) return cleanShares;
  if (!cleanNotes.some((note) => note.id === clean.noteId)) return cleanShares;
  if (cleanShares.some((item) => item.id === clean.id)) return cleanShares;
  return [...cleanShares, clean];
}

export function removeEducationShare(list, id) {
  const cleanList = normalizeEducationShareList(list);
  const target = cleanText(id);
  if (!target) return cleanList;
  return cleanList.filter((item) => item.id !== target);
}

export function educationNotesSorted(list) {
  return normalizeEducationNoteList(list).sort((a, b) =>
    a.title.localeCompare(b.title) || a.id.localeCompare(b.id));
}

export function educationSharesForNote(list, noteId) {
  const target = cleanText(noteId);
  if (!target) return [];
  return normalizeEducationShareList(list)
    .filter((share) => share.noteId === target)
    .sort((a, b) => b.sharedDate.localeCompare(a.sharedDate) || a.id.localeCompare(b.id));
}

export function educationSharesForCustomer(list, customerId) {
  const target = cleanText(customerId);
  if (!target) return [];
  return normalizeEducationShareList(list)
    .filter((share) => share.customerId.toLowerCase() === target.toLowerCase())
    .sort((a, b) => b.sharedDate.localeCompare(a.sharedDate) || a.id.localeCompare(b.id));
}

// Three starter notes matching the problem statement's examples.
// They are templates only: the operator records them into the library
// like any other note (same ids, so recording twice changes nothing).
export function educationNoteStarters() {
  return [
    {
      id: 'EDU-RESTART-ONU',
      title: 'How to restart your ONU',
      steps: [
        'Switch the ONU power off and wait 30 seconds.',
        'Switch it back on and wait for the lights to settle.',
        'If the internet light is still off after two minutes, call the shop instead of resetting again.',
      ],
      appliesWhen: 'When the internet stops suddenly but the power at home is fine.',
    },
    {
      id: 'EDU-BLINKING-LIGHT',
      title: 'What a blinking light means',
      steps: [
        'A steady power light means the ONU has power.',
        'A blinking internet light usually means it is still connecting — wait two minutes.',
        'A red light, or no light at all, means call the shop and tell them which light you see.',
      ],
      appliesWhen: 'When a customer asks why a light on the ONU is blinking or red.',
    },
    {
      id: 'EDU-WHEN-TO-CALL',
      title: 'When to call instead of resetting',
      steps: [
        'Restart the ONU once, as shown in the restart note.',
        'If the problem comes back within a day, do not keep resetting.',
        'Call the shop and say when it started and which lights you see.',
      ],
      appliesWhen: 'When the same problem keeps coming back after a restart.',
    },
  ];
}

export function educationNoteSummaryText(list) {
  const notes = normalizeEducationNoteList(list);
  return `${notes.length} education note${notes.length === 1 ? '' : 's'}`;
}

export function educationShareSummaryText(list) {
  const shares = normalizeEducationShareList(list);
  return `${shares.length} share${shares.length === 1 ? '' : 's'} recorded`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function educationNoteHtml(note) {
  const clean = normalizeEducationNote(note);
  if (!clean) return '';
  const steps = clean.steps.map((step) => `<li>${escapeHtml(step)}</li>`).join('');
  return `<div><strong>${escapeHtml(clean.title)}</strong> <span>(${escapeHtml(clean.id)})</span><br>` +
    `<em>Applies when: ${escapeHtml(clean.appliesWhen)}</em><ol>${steps}</ol></div>`;
}

export function educationNoteAllHtml(list) {
  const notes = educationNotesSorted(list);
  if (notes.length === 0) return '<p>No education notes recorded yet.</p>';
  return notes.map((note) => educationNoteHtml(note)).join('');
}

export function educationShareHtml(share, notes) {
  const clean = normalizeEducationShare(share);
  if (!clean) return '';
  const note = findEducationNote(notes || [], clean.noteId);
  const title = note ? note.title : clean.noteId;
  return `<div><strong>${escapeHtml(title)}</strong> shared with ${escapeHtml(clean.customerId)} on ${escapeHtml(clean.sharedDate)} <span>(${escapeHtml(clean.id)})</span></div>`;
}

export function educationShareAllHtml(list, notes) {
  const shares = normalizeEducationShareList(list)
    .sort((a, b) => b.sharedDate.localeCompare(a.sharedDate) || a.id.localeCompare(b.id));
  if (shares.length === 0) return '<p>No shares recorded yet.</p>';
  return shares.map((share) => educationShareHtml(share, notes)).join('');
}

function csvCell(value) {
  const text = String(value).replace(/"/g, '""');
  return `"${text}"`;
}

export function educationNoteCsv(list) {
  const rows = [['id', 'title', 'steps', 'appliesWhen']];
  for (const note of normalizeEducationNoteList(list)) {
    rows.push([note.id, note.title, note.steps.join(' | '), note.appliesWhen]);
  }
  return rows.map((row) => row.map(csvCell).join(',')).join('\n');
}

export function educationNoteFilename() {
  return 'education-notes.csv';
}

export function educationShareCsv(list) {
  const rows = [['id', 'noteId', 'customerId', 'sharedDate']];
  for (const share of normalizeEducationShareList(list)) {
    rows.push([share.id, share.noteId, share.customerId, share.sharedDate]);
  }
  return rows.map((row) => row.map(csvCell).join(',')).join('\n');
}

export function educationShareFilename() {
  return 'education-note-shares.csv';
}
