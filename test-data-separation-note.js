// Test data separation note (Plan 341): one note per test data set, so
// training and testing entries never sit beside live records unmarked.
// A note carries the set reference, the records included in the set, the
// marked-as-test method in plain words, the date the set was created, and
// the date it was cleared (empty while the set is still open). Test records
// are listed separately from live records and excluded from live totals on
// the same fixture. The note only marks test data: it never creates test
// data, never converts test data to live data, and never changes any live
// customer, bill, or payment record. Inputs are never mutated, and the
// module never reads storage, the clock, the network, or the page.

const TEST_DATA_SEPARATION_DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function isTestDataSeparationLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function validTestDataSeparationDay(value) {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12) return false;
  let lastDay = TEST_DATA_SEPARATION_DAYS_IN_MONTH[month - 1];
  if (month === 2 && isTestDataSeparationLeapYear(year)) lastDay = 29;
  return day >= 1 && day <= lastDay;
}

function cleanTestDataSeparationText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function normalizeTestDataSeparationRecords(value) {
  const parts = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : [];
  const out = [];
  const seen = new Set();
  for (const part of parts) {
    const clean = cleanTestDataSeparationText(part);
    if (!clean) continue;
    const key = clean.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(clean);
  }
  return out;
}

export function normalizeTestDataSeparationNote(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = cleanTestDataSeparationText(raw.id);
  const setRef = cleanTestDataSeparationText(raw.setRef);
  const records = normalizeTestDataSeparationRecords(raw.records);
  const method = cleanTestDataSeparationText(raw.method);
  const dateCreated = cleanTestDataSeparationText(raw.dateCreated);
  const dateCleared = cleanTestDataSeparationText(raw.dateCleared);
  if (!id || !setRef || !records.length || !method || !validTestDataSeparationDay(dateCreated)) return null;
  if (dateCleared && (!validTestDataSeparationDay(dateCleared) || dateCleared < dateCreated)) return null;
  return { id, setRef, records, method, dateCreated, dateCleared };
}

export function normalizeTestDataSeparationNoteList(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const raw of list) {
    const clean = normalizeTestDataSeparationNote(raw);
    if (clean) out.push(clean);
  }
  return out;
}

export function recordTestDataSeparationNote(list, note) {
  const clean = normalizeTestDataSeparationNote(note);
  if (!clean) return list;
  const known = normalizeTestDataSeparationNoteList(list);
  if (known.some((entry) => entry.id === clean.id)) return list;
  return [...known, clean];
}

export function testDataSeparationNoteForSet(list, setRef) {
  const clean = normalizeTestDataSeparationNoteList(list);
  const wanted = cleanTestDataSeparationText(setRef).toLowerCase();
  if (!wanted) return null;
  return clean.find((note) => note.setRef.toLowerCase() === wanted) ?? null;
}

function testDataSeparationCompareDate(a, b) {
  if (a.dateCreated !== b.dateCreated) return a.dateCreated < b.dateCreated ? -1 : 1;
  const aRef = a.setRef.toLowerCase();
  const bRef = b.setRef.toLowerCase();
  if (aRef !== bRef) return aRef < bRef ? -1 : 1;
  return 0;
}

export function openTestDataSeparationNotes(list) {
  const clean = normalizeTestDataSeparationNoteList(list);
  return clean.filter((note) => !note.dateCleared).sort(testDataSeparationCompareDate);
}

export function clearTestDataSeparationNote(list, id, dateCleared) {
  const known = normalizeTestDataSeparationNoteList(list);
  const wanted = cleanTestDataSeparationText(id);
  const cleared = cleanTestDataSeparationText(dateCleared);
  const target = known.find((note) => note.id === wanted);
  if (!target || target.dateCleared) return list;
  if (!validTestDataSeparationDay(cleared) || cleared < target.dateCreated) return list;
  return known.map((note) => (note.id === wanted ? { ...note, dateCleared: cleared } : note));
}

function normalizeTestDataSeparationLedgerRecord(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const ref = cleanTestDataSeparationText(raw.ref);
  const amount = typeof raw.amount === 'number' && Number.isInteger(raw.amount) && raw.amount >= 0 ? raw.amount : null;
  if (!ref || amount === null) return null;
  return { ref, amount };
}

export function normalizeTestDataSeparationLedgerRecords(records) {
  if (!Array.isArray(records)) return [];
  const out = [];
  for (const raw of records) {
    const clean = normalizeTestDataSeparationLedgerRecord(raw);
    if (clean) out.push(clean);
  }
  return out;
}

export function splitTestDataRecords(notes, records) {
  const clean = normalizeTestDataSeparationNoteList(notes);
  const ledger = normalizeTestDataSeparationLedgerRecords(records);
  const testRefs = new Set();
  for (const note of clean) {
    if (note.dateCleared) continue;
    for (const ref of note.records) testRefs.add(ref.toLowerCase());
  }
  const test = [];
  const live = [];
  let testTotal = 0;
  let liveTotal = 0;
  for (const record of ledger) {
    if (testRefs.has(record.ref.toLowerCase())) {
      test.push(record);
      testTotal += record.amount;
    } else {
      live.push(record);
      liveTotal += record.amount;
    }
  }
  return { test, live, testTotal, liveTotal };
}

export function testDataSeparationNoteCounts(list) {
  const clean = normalizeTestDataSeparationNoteList(list);
  const sets = new Set(clean.map((note) => note.setRef.toLowerCase())).size;
  const open = clean.filter((note) => !note.dateCleared).length;
  return { total: clean.length, sets, open };
}

export function testDataSeparationNoteSummaryText(list) {
  const counts = testDataSeparationNoteCounts(list);
  if (!counts.total) return 'No test data separation notes.';
  const noteText = counts.total === 1 ? '1 separation note' : `${counts.total} separation notes`;
  const setText = counts.sets === 1 ? '1 test set' : `${counts.sets} test sets`;
  let text = `${noteText} covering ${setText}.`;
  if (counts.open) {
    const openText = counts.open === 1 ? '1 set' : `${counts.open} sets`;
    text += ` ${openText} still open.`;
  }
  return text;
}

function testDataSeparationNoteDetailText(note) {
  const clearedText = note.dateCleared ? `; cleared ${note.dateCleared}` : '; still open';
  return `records: ${note.records.join(', ')}; method: ${note.method}; created ${note.dateCreated}${clearedText}`;
}

export function testDataSeparationNoteText(note) {
  const clean = normalizeTestDataSeparationNote(note);
  if (!clean) return '';
  return `${clean.setRef} — ${testDataSeparationNoteDetailText(clean)}`;
}

export function testDataSeparationNotesText(list) {
  const clean = normalizeTestDataSeparationNoteList(list);
  if (!clean.length) return 'No test data separation notes.';
  return [...clean].sort(testDataSeparationCompareDate).map((note) => testDataSeparationNoteText(note)).join('\n');
}

function escapeTestDataSeparationHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function testDataSeparationNoteHtml(note) {
  const clean = normalizeTestDataSeparationNote(note);
  if (!clean) return '';
  return `<div><strong>${escapeTestDataSeparationHtml(clean.setRef)}</strong> — ${escapeTestDataSeparationHtml(testDataSeparationNoteDetailText(clean))}</div>`;
}

export function testDataSeparationNotesHtml(list) {
  const clean = normalizeTestDataSeparationNoteList(list);
  if (!clean.length) return '<p>No test data separation notes yet.</p>';
  const items = [...clean]
    .sort(testDataSeparationCompareDate)
    .map((note) => `<li>${escapeTestDataSeparationHtml(testDataSeparationNoteText(note))}</li>`)
    .join('');
  return `<ul>${items}</ul>`;
}

export function testDataSeparationOpenHtml(list) {
  const open = openTestDataSeparationNotes(list);
  if (!open.length) return '<p>No open test sets.</p>';
  const items = open.map((note) => `<li>${escapeTestDataSeparationHtml(testDataSeparationNoteText(note))}</li>`).join('');
  return `<ul>${items}</ul>`;
}

function testDataSeparationCsvCell(value) {
  const text = String(value ?? '');
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function testDataSeparationNoteCsv(list) {
  const clean = normalizeTestDataSeparationNoteList(list);
  const header = ['id', 'setRef', 'records', 'method', 'dateCreated', 'dateCleared'];
  const lines = [header.map(testDataSeparationCsvCell).join(',')];
  for (const note of clean) {
    lines.push([
      note.id,
      note.setRef,
      note.records.join('; '),
      note.method,
      note.dateCreated,
      note.dateCleared,
    ].map(testDataSeparationCsvCell).join(','));
  }
  return lines.join('\n');
}

export function testDataSeparationNoteFilename() {
  return 'test-data-separation-notes.csv';
}
