// Plan 236 (Plan 203-350) — Weather disruption log.
//
// Storms and heavy rain disrupt field work and service, but each
// disruption is remembered separately, so the same weather pattern
// keeps catching the team unprepared. This module adds only the
// missing piece: one log entry per weather disruption — the date,
// the weather as described by the operator, the mohallas affected,
// the visits postponed, and the faults attributed to it.
//
// One log entry: the id, a strict calendar date, the weather
// description as entered, the mohallas affected, the visits
// postponed, the faults attributed (possibly none), and dated
// annotations added later.
//
// The fences, stated plainly:
//   - This logs dated disruptions only. It is not the forward-
//     looking seasonal risk note (Plan 159), which names a season
//     and a preparedness action before the season: that module is
//     neither read nor rewritten here, and this module imports
//     nothing.
//   - Past entries are never edited, only annotated. There is no
//     edit function: only record, annotate, and remove. An
//     annotation never rewrites the date, the weather, the
//     mohallas, the visits postponed, or the faults attributed.
//   - Disruptions list by date and by mohalla, and each entry
//     names the visits postponed. An entry with no visits
//     postponed is refused: a disruption that postponed nothing
//     is not a disruption log entry.
//   - Recording a disruption never changes any bill, payment,
//     customer, fault, or visit record by itself: the module takes
//     no bill, payment, customer, fault, or visit object in, edits
//     none, and returns none. It holds disruption entries only.
//     Mohallas, visits, and faults arrive as plain text.
//   - Inputs are never mutated, and the module never reads
//     storage, the clock, the network, or the page.

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function validWeatherDisruptionDate(value) {
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

function textList(value) {
  if (Array.isArray(value)) return value.map(text).filter(Boolean);
  if (typeof value === 'string') return value.split(',').map(text).filter(Boolean);
  return [];
}

function cleanAnnotation(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const date = text(raw.date);
  const note = text(raw.note);
  if (!validWeatherDisruptionDate(date) || !note) return null;
  return { date, note };
}

function normalizeEntry(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = text(raw.id);
  const date = text(raw.date);
  const weather = text(raw.weather);
  const mohallas = textList(raw.mohallas);
  const visitsPostponed = textList(raw.visitsPostponed);
  const faultsAttributed = textList(raw.faultsAttributed);
  if (!id || !validWeatherDisruptionDate(date) || !weather) return null;
  if (mohallas.length === 0 || visitsPostponed.length === 0) return null;
  const annotations = Array.isArray(raw.annotations)
    ? raw.annotations.map(cleanAnnotation).filter(Boolean)
    : [];
  return { id, date, weather, mohallas, visitsPostponed, faultsAttributed, annotations };
}

export function normalizeWeatherDisruptionList(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of list) {
    const entry = normalizeEntry(raw);
    if (entry && !seen.has(entry.id)) {
      seen.add(entry.id);
      out.push(entry);
    }
  }
  return out;
}

export function recordWeatherDisruption(list, raw) {
  const clean = normalizeWeatherDisruptionList(list);
  const entry = normalizeEntry(raw);
  if (!entry) return clean;
  if (clean.some((item) => item.id === entry.id)) return clean;
  return [...clean, entry];
}

export function removeWeatherDisruption(list, id) {
  const clean = normalizeWeatherDisruptionList(list);
  const wanted = text(id);
  if (!wanted) return clean;
  return clean.filter((item) => item.id !== wanted);
}

export function findWeatherDisruption(list, id) {
  const clean = normalizeWeatherDisruptionList(list);
  const wanted = text(id);
  if (!wanted) return null;
  return clean.find((item) => item.id === wanted) || null;
}

export function weatherDisruptionsSorted(list) {
  const clean = normalizeWeatherDisruptionList(list);
  return [...clean].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

export function weatherDisruptionsForMohalla(list, query) {
  const needle = text(query).toLowerCase();
  const sorted = weatherDisruptionsSorted(list);
  if (!needle) return sorted;
  return sorted.filter((item) =>
    item.mohallas.some((mohalla) => mohalla.toLowerCase().includes(needle))
  );
}

export function weatherDisruptionMohallas(list) {
  const clean = normalizeWeatherDisruptionList(list);
  const seen = new Map();
  for (const item of clean) {
    for (const mohalla of item.mohallas) {
      const key = mohalla.toLowerCase();
      if (!seen.has(key)) seen.set(key, mohalla);
    }
  }
  return [...seen.values()].sort((a, b) =>
    a.toLowerCase() < b.toLowerCase() ? -1 : a.toLowerCase() > b.toLowerCase() ? 1 : 0
  );
}

export function addWeatherDisruptionAnnotation(list, id, date, note) {
  const clean = normalizeWeatherDisruptionList(list);
  const wanted = text(id);
  const annotation = cleanAnnotation({ date, note });
  if (!wanted || !annotation) return clean;
  let changed = false;
  const next = clean.map((item) => {
    if (item.id !== wanted) return item;
    changed = true;
    return { ...item, annotations: [...item.annotations, annotation] };
  });
  return changed ? next : clean;
}

export function weatherDisruptionSummaryText(list) {
  const clean = normalizeWeatherDisruptionList(list);
  const mohallas = weatherDisruptionMohallas(clean);
  const visits = clean.reduce((sum, item) => sum + item.visitsPostponed.length, 0);
  const faults = clean.reduce((sum, item) => sum + item.faultsAttributed.length, 0);
  if (clean.length === 0) return 'No weather disruptions recorded.';
  return `${clean.length} weather disruption${clean.length === 1 ? '' : 's'} across ${mohallas.length} mohalla${mohallas.length === 1 ? '' : 's'}: ${visits} visit${visits === 1 ? '' : 's'} postponed, ${faults} fault${faults === 1 ? '' : 's'} attributed.`;
}

function joinOrFallback(items, fallback) {
  return items.length ? items.join(', ') : fallback;
}

export function weatherDisruptionText(entry) {
  const clean = normalizeEntry(entry);
  if (!clean) return 'No disruption recorded.';
  const faults = joinOrFallback(clean.faultsAttributed, 'No faults attributed');
  const notes = clean.annotations.length
    ? ` Annotations: ${clean.annotations.map((a) => `${a.date}: ${a.note}`).join('; ')}.`
    : '';
  return `${clean.weather} on ${clean.date}. Mohallas affected: ${clean.mohallas.join(', ')}. Visits postponed: ${clean.visitsPostponed.join(', ')}. Faults attributed: ${faults}.${notes}`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function weatherDisruptionHtml(entry) {
  const clean = normalizeEntry(entry);
  if (!clean) return '<p>No disruption recorded.</p>';
  const faults = joinOrFallback(clean.faultsAttributed, 'No faults attributed');
  const notes = clean.annotations.length
    ? `<br>Annotations: ${escapeHtml(clean.annotations.map((a) => `${a.date}: ${a.note}`).join('; '))}`
    : '';
  return `<p><strong>${escapeHtml(clean.weather)}</strong> on ${escapeHtml(clean.date)}. Mohallas affected: ${escapeHtml(clean.mohallas.join(', '))}. Visits postponed: ${escapeHtml(clean.visitsPostponed.join(', '))}. Faults attributed: ${escapeHtml(faults)}.${notes}</p>`;
}

function csvCell(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

export function weatherDisruptionCsv(list) {
  const sorted = weatherDisruptionsSorted(list);
  const header = ['id', 'date', 'weather', 'mohallas affected', 'visits postponed', 'faults attributed', 'annotations'];
  const rows = sorted.map((item) => [
    item.id,
    item.date,
    item.weather,
    item.mohallas.join('; '),
    item.visitsPostponed.join('; '),
    item.faultsAttributed.join('; '),
    item.annotations.map((a) => `${a.date}: ${a.note}`).join('; '),
  ]);
  return [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\n');
}

export function weatherDisruptionFilename() {
  return 'weather-disruption-log.csv';
}
