// App performance note (Plan 335): one note per observation of a slow
// screen or a long wait, so slowness reported verbally is captured with
// evidence instead of being forgotten. A note carries the screen, the
// device it was seen on, the symptom in plain words, the date, and how
// often it happens. The note records observations only: it never
// optimises anything, never changes any screen, and recording a note
// never changes any bill, payment, or customer record by itself. The
// work that makes screens faster is separate and is neither read nor
// changed here. Notes are never edited and never deleted: a wrong note
// stays on the record as it was written. Inputs are never mutated, and
// the module never reads storage, the clock, the network, or the page.

const APP_PERFORMANCE_DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function isAppPerformanceLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function validAppPerformanceDay(value) {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12) return false;
  let lastDay = APP_PERFORMANCE_DAYS_IN_MONTH[month - 1];
  if (month === 2 && isAppPerformanceLeapYear(year)) lastDay = 29;
  return day >= 1 && day <= lastDay;
}

export function foldAppPerformanceFrequency(value) {
  const text = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (text === 'once' || text === 'sometimes' || text === 'often' || text === 'every time') return text;
  return 'once';
}

function appPerformanceText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function normalizeAppPerformanceNote(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const id = appPerformanceText(raw.id);
  const screen = appPerformanceText(raw.screen);
  const symptom = appPerformanceText(raw.symptom);
  const date = appPerformanceText(raw.date);
  if (!id || !screen || !symptom || !validAppPerformanceDay(date)) return null;
  const device = appPerformanceText(raw.device);
  const frequency = foldAppPerformanceFrequency(raw.frequency);
  return { id, screen, device, symptom, date, frequency };
}

export function normalizeAppPerformanceNoteList(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of list) {
    const note = normalizeAppPerformanceNote(raw);
    if (note && !seen.has(note.id)) {
      seen.add(note.id);
      out.push(note);
    }
  }
  return out;
}

export function findAppPerformanceNote(list, id) {
  const clean = normalizeAppPerformanceNoteList(list);
  const wanted = appPerformanceText(id);
  if (!wanted) return null;
  return clean.find((note) => note.id === wanted) || null;
}

export function recordAppPerformanceNote(list, note) {
  const clean = normalizeAppPerformanceNoteList(list);
  const next = normalizeAppPerformanceNote(note);
  if (!next) return clean;
  if (clean.some((entry) => entry.id === next.id)) return clean;
  return [...clean, next];
}

function compareAppPerformanceNotesNewestFirst(a, b) {
  if (a.date !== b.date) return a.date < b.date ? 1 : -1;
  if (a.id !== b.id) return a.id < b.id ? -1 : 1;
  return 0;
}

export function appPerformanceNotesForScreen(list, screen) {
  const clean = normalizeAppPerformanceNoteList(list);
  const wanted = appPerformanceText(screen).toLowerCase();
  if (!wanted) return [];
  return clean
    .filter((note) => note.screen.toLowerCase() === wanted)
    .sort(compareAppPerformanceNotesNewestFirst);
}

export function appPerformanceScreens(list) {
  const clean = normalizeAppPerformanceNoteList(list);
  const seen = new Map();
  for (const note of clean) {
    const key = note.screen.toLowerCase();
    if (!seen.has(key)) seen.set(key, note.screen);
  }
  return [...seen.values()].sort((a, b) => (a.toLowerCase() < b.toLowerCase() ? -1 : a.toLowerCase() > b.toLowerCase() ? 1 : 0));
}

export function appPerformanceCountsByScreen(list, startDate, endDate) {
  const start = appPerformanceText(startDate);
  const end = appPerformanceText(endDate);
  if (!validAppPerformanceDay(start) || !validAppPerformanceDay(end)) return null;
  if (start > end) return null;
  const clean = normalizeAppPerformanceNoteList(list);
  const counts = new Map();
  for (const note of clean) {
    if (note.date < start || note.date > end) continue;
    const key = note.screen.toLowerCase();
    if (!counts.has(key)) counts.set(key, { screen: note.screen, count: 0 });
    counts.get(key).count += 1;
  }
  return [...counts.values()].sort((a, b) => {
    if (a.count !== b.count) return b.count - a.count;
    return a.screen.toLowerCase() < b.screen.toLowerCase() ? -1 : a.screen.toLowerCase() > b.screen.toLowerCase() ? 1 : 0;
  });
}

export function appPerformanceSummaryText(list) {
  const clean = normalizeAppPerformanceNoteList(list);
  if (!clean.length) return 'No app performance notes recorded.';
  const screens = appPerformanceScreens(clean);
  const counts = appPerformanceCountsByScreen(clean, '0001-01-01', '9999-12-31') || [];
  const most = counts.length ? counts[0] : null;
  const mostText = most ? ` Most reported: ${most.screen} (${most.count}).` : '';
  return `${clean.length} app performance note${clean.length === 1 ? '' : 's'} across ${screens.length} screen${screens.length === 1 ? '' : 's'}.${mostText}`;
}

export function appPerformanceFrequencyText(frequency) {
  const folded = foldAppPerformanceFrequency(frequency);
  if (folded === 'sometimes') return 'Sometimes';
  if (folded === 'often') return 'Often';
  if (folded === 'every time') return 'Every time';
  return 'Once';
}

function escapeAppPerformanceHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function appPerformanceDeviceText(device) {
  return device ? device : 'Device not recorded';
}

export function appPerformanceNoteText(note) {
  const clean = normalizeAppPerformanceNote(note);
  if (!clean) return '';
  return `${clean.screen} — ${clean.symptom} (${appPerformanceFrequencyText(clean.frequency)}, ${appPerformanceDeviceText(clean.device)}, ${clean.date})`;
}

export function appPerformanceNoteHtml(note) {
  const clean = normalizeAppPerformanceNote(note);
  if (!clean) return '';
  return `<div><strong>${escapeAppPerformanceHtml(clean.screen)}</strong> — ${escapeAppPerformanceHtml(clean.symptom)}<br>${escapeAppPerformanceHtml(appPerformanceFrequencyText(clean.frequency))} · ${escapeAppPerformanceHtml(appPerformanceDeviceText(clean.device))} · ${escapeAppPerformanceHtml(clean.date)}</div>`;
}

export function appPerformanceNotesHtml(list) {
  const clean = normalizeAppPerformanceNoteList(list);
  if (!clean.length) return '<p>No app performance notes recorded.</p>';
  return appPerformanceScreens(clean).map((screen) => {
    const notes = appPerformanceNotesForScreen(clean, screen);
    const items = notes.map((note) => `<li>${escapeAppPerformanceHtml(appPerformanceNoteText(note))}</li>`).join('');
    return `<h4>${escapeAppPerformanceHtml(screen)} (${notes.length})</h4><ul>${items}</ul>`;
  }).join('');
}

export function appPerformanceCountsHtml(list, startDate, endDate) {
  const counts = appPerformanceCountsByScreen(list, startDate, endDate);
  if (!counts) return '<p>Give a valid from and to date, with from on or before to, to see counts.</p>';
  if (!counts.length) return '<p>No app performance notes in this period.</p>';
  const items = counts.map((entry) => `<li>${escapeAppPerformanceHtml(entry.screen)}: ${entry.count}</li>`).join('');
  return `<ul>${items}</ul>`;
}

function appPerformanceCsvCell(value) {
  const text = String(value ?? '');
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function appPerformanceCsv(list) {
  const clean = normalizeAppPerformanceNoteList(list);
  const header = ['id', 'screen', 'device', 'symptom', 'date', 'frequency'];
  const lines = [header.map(appPerformanceCsvCell).join(',')];
  for (const note of clean) {
    lines.push([
      note.id,
      note.screen,
      note.device,
      note.symptom,
      note.date,
      note.frequency,
    ].map(appPerformanceCsvCell).join(','));
  }
  return lines.join('\n');
}

export function appPerformanceFilename() {
  return 'app-performance-notes.csv';
}
