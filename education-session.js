// Plan 269 (Plan 203-350) — Customer education session log.
//
// Education notes are shared as drafts, but there was no record
// of an actual teaching session: what was taught, when, and to
// whom. This module adds only the missing piece: one session
// record per education session held — the date, the mohalla or
// the customer, the topic taught, the operator, and a note — so
// the owner can see which teaching actually happened, instead
// of guessing from drafts alone.
//
// What this module is NOT, stated plainly:
//   - It is not the education notes shared as drafts (Plan 169).
//     Those drafts are the teaching material prepared in
//     advance, and they are neither read nor rewritten here.
//     This module records only sessions that were actually
//     held, with the date and the topic taught.
//   - It never changes any customer record, bill, or payment.
//     This module holds no customer status, bill, or payment
//     field, so there is nothing here that could rewrite one.
//     Recording a session only adds the session record.
//   - It never sends any message. Logging that a session was
//     held is a record only; nothing here contacts a customer.
//   - A session is refused when it has no date or no topic,
//     and when it names neither a mohalla nor a customer.
//     A session must be for a mohalla or for a customer.
//   - A session is never edited, only annotated. There is no
//     edit function: only record, annotate, and remove. A
//     dated follow-up never rewrites the date, the mohalla,
//     the customer, the topic, the operator, or the note.
//   - Inputs are never mutated, and the module never reads
//     storage, the clock, the network, or the page.

export const EDUCATION_SESSION_STORE = 'shahdara_education_sessions_v1';
export const EDUCATION_SESSION_FILENAME = 'education-sessions.csv';

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function validEducationSessionDate(value) {
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

function cleanFollowup(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const date = text(raw.date);
  const note = text(raw.note);
  if (!validEducationSessionDate(date) || !note) return null;
  return { date, note };
}

function normalizeEntry(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = text(raw.id);
  const date = text(raw.date);
  const mohalla = text(raw.mohalla);
  const customer = text(raw.customer);
  const topic = text(raw.topic);
  if (!id || !topic) return null;
  if (!validEducationSessionDate(date)) return null;
  if (!mohalla && !customer) return null;
  const operator = text(raw.operator);
  const note = text(raw.note);
  const followups = Array.isArray(raw.followups)
    ? raw.followups.map(cleanFollowup).filter(Boolean)
    : [];
  return { id, date, mohalla, customer, topic, operator, note, followups };
}

export function normalizeEducationSessionList(list) {
  if (!Array.isArray(list)) return [];
  const seenIds = new Set();
  const out = [];
  for (const raw of list) {
    const entry = normalizeEntry(raw);
    if (!entry) continue;
    if (seenIds.has(entry.id)) continue;
    seenIds.add(entry.id);
    out.push(entry);
  }
  return out;
}

export function recordEducationSession(list, raw) {
  const clean = normalizeEducationSessionList(list);
  const entry = normalizeEntry(raw);
  if (!entry) return clean;
  if (clean.some((item) => item.id === entry.id)) return clean;
  return [...clean, entry];
}

export function removeEducationSession(list, id) {
  const clean = normalizeEducationSessionList(list);
  const wanted = text(id);
  if (!wanted) return clean;
  return clean.filter((item) => item.id !== wanted);
}

export function findEducationSession(list, id) {
  const clean = normalizeEducationSessionList(list);
  const wanted = text(id);
  if (!wanted) return null;
  return clean.find((item) => item.id === wanted) || null;
}

export function addEducationSessionNote(list, id, date, note) {
  const clean = normalizeEducationSessionList(list);
  const wanted = text(id);
  const followup = cleanFollowup({ date, note });
  if (!wanted || !followup) return clean;
  let changed = false;
  const out = clean.map((item) => {
    if (item.id !== wanted) return item;
    changed = true;
    return { ...item, followups: [...item.followups, followup] };
  });
  return changed ? out : clean;
}

function compareEntries(a, b) {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  if (a.topic !== b.topic) return a.topic < b.topic ? -1 : 1;
  if (a.id !== b.id) return a.id < b.id ? -1 : 1;
  return 0;
}

export function educationSessionSorted(list) {
  return normalizeEducationSessionList(list).sort(compareEntries);
}

export function sessionsByTopic(list, topic) {
  const wanted = text(topic).toLowerCase();
  if (!wanted) return [];
  return educationSessionSorted(list).filter((item) => item.topic.toLowerCase() === wanted);
}

export function sessionsByMohalla(list, mohalla) {
  const wanted = text(mohalla).toLowerCase();
  if (!wanted) return [];
  return educationSessionSorted(list).filter((item) => item.mohalla.toLowerCase() === wanted);
}

export function sessionsForCustomer(list, customer) {
  const wanted = text(customer).toLowerCase();
  if (!wanted) return [];
  return educationSessionSorted(list).filter((item) => item.customer.toLowerCase() === wanted);
}

export function educationSessionMohallas(list) {
  const seen = new Set();
  const out = [];
  for (const item of educationSessionSorted(list)) {
    if (!item.mohalla) continue;
    const key = item.mohalla.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item.mohalla);
  }
  return out;
}

export function educationSessionTopics(list) {
  const seen = new Set();
  const out = [];
  for (const item of educationSessionSorted(list)) {
    const key = item.topic.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item.topic);
  }
  return out;
}

export function educationSessionSummaryText(list) {
  const clean = normalizeEducationSessionList(list);
  if (!clean.length) return 'No education sessions recorded.';
  const topics = educationSessionTopics(list).length;
  return `${clean.length} education session${clean.length === 1 ? '' : 's'} across ${topics} topic${topics === 1 ? '' : 's'}.`;
}

export function educationSessionText(entry) {
  const clean = normalizeEntry(entry);
  if (!clean) return 'No education session recorded.';
  const whom = clean.customer && clean.mohalla
    ? `${clean.customer} (${clean.mohalla})`
    : clean.customer || clean.mohalla;
  const by = clean.operator ? ` by ${clean.operator}` : '';
  const note = clean.note ? ` ${clean.note.replace(/\.+$/, '')}.` : '';
  const notes = clean.followups.length
    ? ` Follow-ups: ${clean.followups.map((f) => `${f.date}: ${f.note}`).join('; ')}`
    : '';
  return `${clean.date}: ${clean.topic.replace(/\.+$/, '')} taught to ${whom}${by}.${note}${notes}`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function educationSessionHtml(entry) {
  const clean = normalizeEntry(entry);
  if (!clean) return '<p>No education session recorded.</p>';
  return `<p>${escapeHtml(educationSessionText(entry))}</p>`;
}

export function educationSessionAllHtml(list) {
  const sorted = educationSessionSorted(list);
  if (!sorted.length) return '<p>No education sessions recorded.</p>';
  return `<ul>${sorted.map((entry) => `<li>${escapeHtml(educationSessionText(entry))}</li>`).join('')}</ul>`;
}

function csvCell(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

export function educationSessionCsv(list) {
  const sorted = educationSessionSorted(list);
  const header = ['id', 'date', 'mohalla', 'customer', 'topic', 'operator', 'note', 'follow-ups'];
  const rows = sorted.map((item) => [
    item.id,
    item.date,
    item.mohalla,
    item.customer,
    item.topic,
    item.operator,
    item.note,
    item.followups.map((f) => `${f.date}: ${f.note}`).join('; '),
  ]);
  return [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\n');
}

export function educationSessionFilename() {
  return 'education-sessions.csv';
}
