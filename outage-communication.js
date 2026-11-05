// Plan 271 (Plan 203-350) — Outage communication log per incident.
//
// During an outage, customers are told things at different times,
// but there was no per-incident log of what was communicated,
// when, and to which mohallas. This module adds only the missing
// piece: one communication entry per outage incident — the
// incident it belongs to, the date and time, the mohallas told,
// a message summary in plain words, and the channel used — so
// the owner can prove customers were kept informed, step by step.
//
// What this module is NOT, stated plainly:
//   - It is not the broadcast draft, the service-status board,
//     or the maintenance notice draft. Those are prepared
//     messages and boards, and they are neither read nor
//     rewritten here. This module records only communications
//     that already happened, linked to an incident by its id.
//   - It never sends any message. Logging a communication is
//     a record only; nothing here contacts a customer.
//   - It never changes any outage, bill, or payment record.
//     This module holds no outage status, bill, or payment
//     field, so there is nothing here that could rewrite one.
//     An entry only adds the communication record.
//   - An entry with no incident link or no mohalla is refused.
//     A communication must belong to an incident and must
//     name at least one mohalla that was told.
//   - Entries are never edited. There is no edit function:
//     only record, find, and remove. A wrong entry is removed
//     and recorded again.
//   - Inputs are never mutated, and the module never reads
//     storage, the clock, the network, or the page.

export const OUTAGE_COMMUNICATION_STORE = 'shahdara_outage_communications_v1';
export const OUTAGE_COMMUNICATION_FILENAME = 'outage-communications.csv';

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function validOutageCommunicationDate(value) {
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

export function validOutageCommunicationTime(value) {
  if (typeof value !== 'string') return false;
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return false;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59;
}

function cleanMohallas(raw) {
  const values = Array.isArray(raw)
    ? raw
    : typeof raw === 'string'
      ? raw.split(',')
      : [];
  const seen = new Set();
  const out = [];
  for (const value of values) {
    const name = text(value);
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out;
}

function normalizeEntry(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = text(raw.id);
  const incidentId = text(raw.incidentId);
  const date = text(raw.date);
  const time = text(raw.time);
  if (!id || !incidentId) return null;
  if (!validOutageCommunicationDate(date)) return null;
  if (!validOutageCommunicationTime(time)) return null;
  const mohallas = cleanMohallas(raw.mohallas);
  if (!mohallas.length) return null;
  const message = text(raw.message);
  const channel = text(raw.channel);
  return { id, incidentId, date, time, mohallas, message, channel };
}

export function normalizeOutageCommunicationList(list) {
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

export function recordOutageCommunication(list, raw) {
  const clean = normalizeOutageCommunicationList(list);
  const entry = normalizeEntry(raw);
  if (!entry) return clean;
  if (clean.some((item) => item.id === entry.id)) return clean;
  return [...clean, entry];
}

export function removeOutageCommunication(list, id) {
  const clean = normalizeOutageCommunicationList(list);
  const wanted = text(id);
  if (!wanted) return clean;
  return clean.filter((item) => item.id !== wanted);
}

export function findOutageCommunication(list, id) {
  const clean = normalizeOutageCommunicationList(list);
  const wanted = text(id);
  if (!wanted) return null;
  return clean.find((item) => item.id === wanted) || null;
}

function compareEntries(a, b) {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  if (a.time !== b.time) return a.time < b.time ? -1 : 1;
  if (a.id !== b.id) return a.id < b.id ? -1 : 1;
  return 0;
}

export function outageCommunicationSorted(list) {
  return normalizeOutageCommunicationList(list).sort(compareEntries);
}

export function communicationsForIncident(list, incidentId) {
  const wanted = text(incidentId).toLowerCase();
  if (!wanted) return [];
  return outageCommunicationSorted(list).filter((item) => item.incidentId.toLowerCase() === wanted);
}

export function outageCommunicationIncidents(list) {
  const seen = new Set();
  const out = [];
  for (const item of outageCommunicationSorted(list)) {
    const key = item.incidentId.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item.incidentId);
  }
  return out;
}

export function outageCommunicationMohallas(list) {
  const seen = new Set();
  const out = [];
  for (const item of outageCommunicationSorted(list)) {
    for (const name of item.mohallas) {
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(name);
    }
  }
  return out;
}

export function outageCommunicationChannels(list) {
  const seen = new Set();
  const out = [];
  for (const item of outageCommunicationSorted(list)) {
    if (!item.channel) continue;
    const key = item.channel.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item.channel);
  }
  return out;
}

export function outageCommunicationSummaryText(list) {
  const clean = normalizeOutageCommunicationList(list);
  if (!clean.length) return 'No outage communications recorded.';
  const incidents = outageCommunicationIncidents(list).length;
  return `${clean.length} outage communication${clean.length === 1 ? '' : 's'} across ${incidents} incident${incidents === 1 ? '' : 's'}.`;
}

export function outageCommunicationText(entry) {
  const clean = normalizeEntry(entry);
  if (!clean) return 'No outage communication recorded.';
  const via = clean.channel ? ` via ${clean.channel}` : '';
  const said = clean.message ? ` ${clean.message.replace(/\.+$/, '')}.` : '';
  return `${clean.date} ${clean.time}: Incident ${clean.incidentId} — told ${clean.mohallas.join(', ')}${via}.${said}`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function outageCommunicationHtml(entry) {
  const clean = normalizeEntry(entry);
  if (!clean) return '<p>No outage communication recorded.</p>';
  return `<p>${escapeHtml(outageCommunicationText(entry))}</p>`;
}

export function outageCommunicationAllHtml(list) {
  const sorted = outageCommunicationSorted(list);
  if (!sorted.length) return '<p>No outage communications recorded.</p>';
  return `<ul>${sorted.map((entry) => `<li>${escapeHtml(outageCommunicationText(entry))}</li>`).join('')}</ul>`;
}

function csvCell(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

export function outageCommunicationCsv(list) {
  const sorted = outageCommunicationSorted(list);
  const header = ['id', 'incident', 'date', 'time', 'mohallas', 'channel', 'message'];
  const rows = sorted.map((item) => [
    item.id,
    item.incidentId,
    item.date,
    item.time,
    item.mohallas.join('; '),
    item.channel,
    item.message,
  ]);
  return [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\n');
}

export function outageCommunicationFilename() {
  return 'outage-communications.csv';
}
