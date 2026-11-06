// Device compatibility note (Plan 343): one note per device and app version
// pair, so the shop knows which phones run the app well before buying a
// second field phone. A note carries the device, the app version, whether
// it works well, works with issues, or does not work, an issue note in
// plain words, and the date tested. A device lookup shows its tested app
// versions with results, and an untested pair says so plainly. The note
// only records test results: it never changes any device, app version,
// bill, or payment record, and it never changes how the app behaves.
// Inputs are never mutated, and the module never reads storage, the
// clock, the network, or the page.

const DEVICE_COMPATIBILITY_NOTE_DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function isDeviceCompatibilityNoteLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function validDeviceCompatibilityNoteDay(value) {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12) return false;
  let lastDay = DEVICE_COMPATIBILITY_NOTE_DAYS_IN_MONTH[month - 1];
  if (month === 2 && isDeviceCompatibilityNoteLeapYear(year)) lastDay = 29;
  return day >= 1 && day <= lastDay;
}

function cleanDeviceCompatibilityNoteText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function foldDeviceCompatibilityNoteResult(value) {
  const clean = cleanDeviceCompatibilityNoteText(value).toLowerCase();
  if (clean === 'works well' || clean === 'well') return 'works well';
  if (clean === 'works with issues' || clean === 'with issues' || clean === 'issues') return 'works with issues';
  if (clean === 'does not work' || clean === 'not working' || clean === 'broken') return 'does not work';
  return null;
}

export function normalizeDeviceCompatibilityNote(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = cleanDeviceCompatibilityNoteText(raw.id);
  const device = cleanDeviceCompatibilityNoteText(raw.device);
  const appVersion = cleanDeviceCompatibilityNoteText(raw.appVersion);
  const result = foldDeviceCompatibilityNoteResult(raw.result);
  const issueNote = cleanDeviceCompatibilityNoteText(raw.issueNote);
  const dateTested = cleanDeviceCompatibilityNoteText(raw.dateTested);
  if (!id || !device || !appVersion || !result) return null;
  if (!validDeviceCompatibilityNoteDay(dateTested)) return null;
  return { id, device, appVersion, result, issueNote, dateTested };
}

export function normalizeDeviceCompatibilityNoteList(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const raw of list) {
    const clean = normalizeDeviceCompatibilityNote(raw);
    if (clean) out.push(clean);
  }
  return out;
}

function deviceCompatibilityNoteSamePair(a, b) {
  return a.device.toLowerCase() === b.device.toLowerCase()
    && a.appVersion.toLowerCase() === b.appVersion.toLowerCase();
}

export function recordDeviceCompatibilityNote(list, note) {
  const clean = normalizeDeviceCompatibilityNote(note);
  if (!clean) return list;
  const known = normalizeDeviceCompatibilityNoteList(list);
  if (known.some((entry) => entry.id === clean.id)) return list;
  if (known.some((entry) => deviceCompatibilityNoteSamePair(entry, clean))) return list;
  return [...known, clean];
}

export function deviceCompatibilityNoteForPair(list, device, appVersion) {
  const clean = normalizeDeviceCompatibilityNoteList(list);
  const wantedDevice = cleanDeviceCompatibilityNoteText(device).toLowerCase();
  const wantedVersion = cleanDeviceCompatibilityNoteText(appVersion).toLowerCase();
  if (!wantedDevice || !wantedVersion) return null;
  return clean.find((entry) => entry.device.toLowerCase() === wantedDevice && entry.appVersion.toLowerCase() === wantedVersion) ?? null;
}

function deviceCompatibilityNoteCompare(a, b) {
  const aDevice = a.device.toLowerCase();
  const bDevice = b.device.toLowerCase();
  if (aDevice !== bDevice) return aDevice < bDevice ? -1 : 1;
  const aVersion = a.appVersion.toLowerCase();
  const bVersion = b.appVersion.toLowerCase();
  if (aVersion !== bVersion) return aVersion < bVersion ? -1 : 1;
  if (a.dateTested !== b.dateTested) return a.dateTested < b.dateTested ? -1 : 1;
  return 0;
}

export function deviceCompatibilityNotesForDevice(list, device) {
  const clean = normalizeDeviceCompatibilityNoteList(list);
  const wanted = cleanDeviceCompatibilityNoteText(device).toLowerCase();
  if (!wanted) return [];
  return clean
    .filter((entry) => entry.device.toLowerCase() === wanted)
    .sort(deviceCompatibilityNoteCompare);
}

export function deviceCompatibilityDevices(list) {
  const clean = normalizeDeviceCompatibilityNoteList(list);
  const seen = new Map();
  for (const entry of clean) {
    const key = entry.device.toLowerCase();
    if (!seen.has(key)) seen.set(key, entry.device);
  }
  return [...seen.values()].sort((a, b) => {
    const lowerA = a.toLowerCase();
    const lowerB = b.toLowerCase();
    if (lowerA !== lowerB) return lowerA < lowerB ? -1 : 1;
    return 0;
  });
}

export function deviceCompatibilityPairText(list, device, appVersion) {
  const deviceText = cleanDeviceCompatibilityNoteText(device);
  const versionText = cleanDeviceCompatibilityNoteText(appVersion);
  if (!deviceText || !versionText) return 'Give a device and an app version to look up.';
  const note = deviceCompatibilityNoteForPair(list, deviceText, versionText);
  if (!note) return `Not tested: ${deviceText} with app version ${versionText} has no compatibility note.`;
  const issueText = note.issueNote ? ` — ${note.issueNote}` : '';
  return `${note.device} with app version ${note.appVersion}: ${note.result}${issueText} (tested ${note.dateTested})`;
}

export function deviceCompatibilityNoteCounts(list) {
  const clean = normalizeDeviceCompatibilityNoteList(list);
  let worksWell = 0;
  let worksWithIssues = 0;
  let doesNotWork = 0;
  for (const entry of clean) {
    if (entry.result === 'works well') worksWell += 1;
    else if (entry.result === 'works with issues') worksWithIssues += 1;
    else if (entry.result === 'does not work') doesNotWork += 1;
  }
  return { total: clean.length, worksWell, worksWithIssues, doesNotWork };
}

export function deviceCompatibilityNoteSummaryText(list) {
  const counts = deviceCompatibilityNoteCounts(list);
  if (!counts.total) return 'No device compatibility notes.';
  const listText = counts.total === 1 ? '1 compatibility note' : `${counts.total} compatibility notes`;
  return `${listText}: ${counts.worksWell} work well, ${counts.worksWithIssues} work with issues, ${counts.doesNotWork} do not work.`;
}

function deviceCompatibilityNoteDetailText(note) {
  const issueText = note.issueNote ? ` — ${note.issueNote}` : '';
  return `${note.result}${issueText}; tested ${note.dateTested}`;
}

export function deviceCompatibilityNoteText(note) {
  const clean = normalizeDeviceCompatibilityNote(note);
  if (!clean) return '';
  return `${clean.device} with app version ${clean.appVersion} — ${deviceCompatibilityNoteDetailText(clean)}`;
}

export function deviceCompatibilityNotesText(list) {
  const clean = normalizeDeviceCompatibilityNoteList(list);
  if (!clean.length) return 'No device compatibility notes.';
  return [...clean].sort(deviceCompatibilityNoteCompare).map((entry) => deviceCompatibilityNoteText(entry)).join('\n');
}

function escapeDeviceCompatibilityNoteHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function deviceCompatibilityNoteHtml(note) {
  const clean = normalizeDeviceCompatibilityNote(note);
  if (!clean) return '';
  return `<div><strong>${escapeDeviceCompatibilityNoteHtml(clean.device)} with app version ${escapeDeviceCompatibilityNoteHtml(clean.appVersion)}</strong> — ${escapeDeviceCompatibilityNoteHtml(deviceCompatibilityNoteDetailText(clean))}</div>`;
}

export function deviceCompatibilityNotesHtml(list) {
  const clean = normalizeDeviceCompatibilityNoteList(list);
  if (!clean.length) return '<p>No device compatibility notes yet.</p>';
  const items = [...clean]
    .sort(deviceCompatibilityNoteCompare)
    .map((entry) => `<li>${escapeDeviceCompatibilityNoteHtml(deviceCompatibilityNoteText(entry))}</li>`)
    .join('');
  return `<ul>${items}</ul>`;
}

export function deviceCompatibilityNotesForDeviceHtml(list, device) {
  const notes = deviceCompatibilityNotesForDevice(list, device);
  const deviceText = cleanDeviceCompatibilityNoteText(device);
  if (!deviceText) return '<p>Give a device to look up.</p>';
  if (!notes.length) return `<p>Not tested: ${escapeDeviceCompatibilityNoteHtml(deviceText)} has no compatibility notes.</p>`;
  const items = notes
    .map((entry) => `<li>${escapeDeviceCompatibilityNoteHtml(deviceCompatibilityNoteText(entry))}</li>`)
    .join('');
  return `<ul>${items}</ul>`;
}

function deviceCompatibilityNoteCsvCell(value) {
  const text = String(value ?? '');
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function deviceCompatibilityNoteCsv(list) {
  const clean = normalizeDeviceCompatibilityNoteList(list);
  const header = ['id', 'device', 'appVersion', 'result', 'issueNote', 'dateTested'];
  const lines = [header.map(deviceCompatibilityNoteCsvCell).join(',')];
  for (const entry of clean) {
    lines.push([
      entry.id,
      entry.device,
      entry.appVersion,
      entry.result,
      entry.issueNote,
      entry.dateTested,
    ].map(deviceCompatibilityNoteCsvCell).join(','));
  }
  return lines.join('\n');
}

export function deviceCompatibilityNoteFilename() {
  return 'device-compatibility-notes.csv';
}
