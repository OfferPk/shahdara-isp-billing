// Screen help note register (Plan 336): one register entry per screen, so
// the shop can see which screens have a help note and which are still
// undocumented. An entry carries the screen name, whether its help note
// is present or missing, the help note reference, and the date checked.
// The register records coverage only: it never writes any help text,
// never changes any screen, and recording or re-checking an entry never
// changes any bill, payment, or customer record by itself. The help
// itself lives elsewhere and is neither read nor changed here. Entries
// are never edited and never deleted: a screen is re-checked by
// recording a fresh check for that screen. Inputs are never mutated,
// and the module never reads storage, the clock, the network, or the
// page.

const SCREEN_HELP_NOTE_DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function isScreenHelpNoteLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function validScreenHelpNoteDay(value) {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12) return false;
  let lastDay = SCREEN_HELP_NOTE_DAYS_IN_MONTH[month - 1];
  if (month === 2 && isScreenHelpNoteLeapYear(year)) lastDay = 29;
  return day >= 1 && day <= lastDay;
}

export function foldScreenHelpNoteStatus(value) {
  const text = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (text === 'present' || text === 'yes' || text === 'has help' || text === 'documented') return 'present';
  return 'missing';
}

function cleanScreenHelpNoteText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function normalizeScreenHelpNote(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const id = cleanScreenHelpNoteText(raw.id);
  const screen = cleanScreenHelpNoteText(raw.screen);
  const dateChecked = cleanScreenHelpNoteText(raw.dateChecked);
  if (!id || !screen || !validScreenHelpNoteDay(dateChecked)) return null;
  const status = foldScreenHelpNoteStatus(raw.status);
  const reference = cleanScreenHelpNoteText(raw.reference);
  return { id, screen, status, reference, dateChecked };
}

export function normalizeScreenHelpNoteList(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of list) {
    const entry = normalizeScreenHelpNote(raw);
    if (entry && !seen.has(entry.id)) {
      seen.add(entry.id);
      out.push(entry);
    }
  }
  return out;
}

export function findScreenHelpNote(list, id) {
  const clean = normalizeScreenHelpNoteList(list);
  const wanted = cleanScreenHelpNoteText(id);
  if (!wanted) return null;
  return clean.find((entry) => entry.id === wanted) || null;
}

export function recordScreenHelpNote(list, entry) {
  const clean = normalizeScreenHelpNoteList(list);
  const next = normalizeScreenHelpNote(entry);
  if (!next) return clean;
  if (clean.some((item) => item.id === next.id)) return clean;
  if (clean.some((item) => item.screen.toLowerCase() === next.screen.toLowerCase())) return clean;
  return [...clean, next];
}

export function updateScreenHelpNoteCheck(list, entry) {
  const clean = normalizeScreenHelpNoteList(list);
  const next = normalizeScreenHelpNote(entry);
  if (!next) return clean;
  const at = clean.findIndex((item) => item.screen.toLowerCase() === next.screen.toLowerCase());
  if (at < 0) return clean;
  const out = [...clean];
  out[at] = next;
  return out;
}

function compareScreenHelpNotesByScreen(a, b) {
  const left = a.screen.toLowerCase();
  const right = b.screen.toLowerCase();
  if (left !== right) return left < right ? -1 : 1;
  if (a.id !== b.id) return a.id < b.id ? -1 : 1;
  return 0;
}

export function screenHelpNoteScreens(list) {
  const clean = normalizeScreenHelpNoteList(list);
  const seen = new Map();
  for (const entry of clean) {
    const key = entry.screen.toLowerCase();
    if (!seen.has(key)) seen.set(key, entry.screen);
  }
  return [...seen.values()].sort((a, b) => (a.toLowerCase() < b.toLowerCase() ? -1 : a.toLowerCase() > b.toLowerCase() ? 1 : 0));
}

function screenHelpNoteScreenList(values) {
  if (!Array.isArray(values)) return [];
  const seen = new Map();
  for (const value of values) {
    const screen = cleanScreenHelpNoteText(value);
    if (!screen) continue;
    const key = screen.toLowerCase();
    if (!seen.has(key)) seen.set(key, screen);
  }
  return [...seen.values()];
}

export function screenHelpNoteGaps(list, screens = []) {
  const clean = normalizeScreenHelpNoteList(list);
  const wanted = screenHelpNoteScreenList(screens);
  const out = [];
  const seen = new Set();
  for (const entry of clean) {
    if (entry.status !== 'missing') continue;
    const key = entry.screen.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ screen: entry.screen, status: 'missing', reference: entry.reference, dateChecked: entry.dateChecked });
  }
  for (const screen of wanted) {
    const key = screen.toLowerCase();
    if (seen.has(key)) continue;
    if (clean.some((entry) => entry.screen.toLowerCase() === key)) continue;
    seen.add(key);
    out.push({ screen, status: 'unregistered', reference: '', dateChecked: '' });
  }
  return out.sort(compareScreenHelpNotesByScreen);
}

export function screenHelpNoteCoverage(list, screens = []) {
  const clean = normalizeScreenHelpNoteList(list);
  const wanted = screenHelpNoteScreenList(screens);
  const presentScreens = [];
  const missingScreens = [];
  const unregisteredScreens = [];
  const seen = new Set();
  for (const entry of clean) {
    const key = entry.screen.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    if (entry.status === 'present') presentScreens.push(entry.screen);
    else missingScreens.push(entry.screen);
  }
  for (const screen of wanted) {
    const key = screen.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unregisteredScreens.push(screen);
  }
  const byName = (a, b) => (a.toLowerCase() < b.toLowerCase() ? -1 : a.toLowerCase() > b.toLowerCase() ? 1 : 0);
  presentScreens.sort(byName);
  missingScreens.sort(byName);
  unregisteredScreens.sort(byName);
  const total = presentScreens.length + missingScreens.length + unregisteredScreens.length;
  return {
    total,
    present: presentScreens.length,
    missing: missingScreens.length,
    unregistered: unregisteredScreens.length,
    presentScreens,
    missingScreens,
    unregisteredScreens,
  };
}

export function screenHelpNoteSummaryText(list, screens = []) {
  const clean = normalizeScreenHelpNoteList(list);
  if (!clean.length && !screenHelpNoteScreenList(screens).length) return 'No screens registered in the help note register.';
  const coverage = screenHelpNoteCoverage(clean, screens);
  const registeredText = `${coverage.present + coverage.missing} screen${coverage.present + coverage.missing === 1 ? '' : 's'} registered: ${coverage.present} with a help note, ${coverage.missing} missing.`;
  if (!screenHelpNoteScreenList(screens).length) return registeredText;
  return `${registeredText} ${coverage.unregistered} screen${coverage.unregistered === 1 ? '' : 's'} not registered.`;
}

export function screenHelpNoteStatusText(status) {
  return foldScreenHelpNoteStatus(status) === 'present' ? 'Help note present' : 'Help note missing';
}

export function screenHelpNoteText(entry) {
  const clean = normalizeScreenHelpNote(entry);
  if (!clean) return '';
  const reference = clean.reference ? ` (${clean.reference})` : '';
  return `${clean.screen} — ${screenHelpNoteStatusText(clean.status)}${reference}, checked ${clean.dateChecked}`;
}

function escapeScreenHelpNoteHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function screenHelpNoteHtml(entry) {
  const clean = normalizeScreenHelpNote(entry);
  if (!clean) return '';
  return `<div><strong>${escapeScreenHelpNoteHtml(clean.screen)}</strong> — ${escapeScreenHelpNoteHtml(screenHelpNoteStatusText(clean.status))}${clean.reference ? ` (${escapeScreenHelpNoteHtml(clean.reference)})` : ''}<br>Checked ${escapeScreenHelpNoteHtml(clean.dateChecked)}</div>`;
}

export function screenHelpNotesHtml(list) {
  const clean = normalizeScreenHelpNoteList(list);
  if (!clean.length) return '<p>No screens registered in the help note register.</p>';
  const items = [...clean].sort(compareScreenHelpNotesByScreen).map((entry) => `<li>${escapeScreenHelpNoteHtml(screenHelpNoteText(entry))}</li>`).join('');
  return `<ul>${items}</ul>`;
}

export function screenHelpNoteGapsHtml(list, screens = []) {
  const gaps = screenHelpNoteGaps(list, screens);
  if (!gaps.length) return '<p>No gaps: every registered screen has a help note.</p>';
  const items = gaps.map((gap) => {
    const label = gap.status === 'unregistered' ? 'Not registered' : 'Help note missing';
    return `<li>${escapeScreenHelpNoteHtml(gap.screen)} — ${escapeScreenHelpNoteHtml(label)}${gap.dateChecked ? ` (checked ${escapeScreenHelpNoteHtml(gap.dateChecked)})` : ''}</li>`;
  }).join('');
  return `<ul>${items}</ul>`;
}

export function screenHelpNoteCoverageHtml(list, screens = []) {
  const coverage = screenHelpNoteCoverage(list, screens);
  if (!coverage.total) return '<p>Give the screens to check, one per line, to see coverage.</p>';
  const lines = [
    `${coverage.total} screen${coverage.total === 1 ? '' : 's'} listed: ${coverage.present} with a help note, ${coverage.missing} missing, ${coverage.unregistered} not registered.`,
  ];
  if (coverage.missingScreens.length) lines.push(`Missing: ${coverage.missingScreens.join(', ')}.`);
  if (coverage.unregisteredScreens.length) lines.push(`Not registered: ${coverage.unregisteredScreens.join(', ')}.`);
  return `<p>${lines.map((line) => escapeScreenHelpNoteHtml(line)).join(' ')}</p>`;
}

function screenHelpNoteCsvCell(value) {
  const text = String(value ?? '');
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function screenHelpNoteCsv(list) {
  const clean = normalizeScreenHelpNoteList(list);
  const header = ['id', 'screen', 'status', 'reference', 'dateChecked'];
  const lines = [header.map(screenHelpNoteCsvCell).join(',')];
  for (const entry of clean) {
    lines.push([
      entry.id,
      entry.screen,
      entry.status,
      entry.reference,
      entry.dateChecked,
    ].map(screenHelpNoteCsvCell).join(','));
  }
  return lines.join('\n');
}

export function screenHelpNoteFilename() {
  return 'screen-help-note-register.csv';
}
