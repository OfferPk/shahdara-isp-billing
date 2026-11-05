// Plan 243 (Plan 203-350) — Night-visit safety pair record.
//
// Night visits are sometimes done alone because nobody recorded who
// was paired with whom, so a lone night visit is discovered only
// afterwards, if at all. This module adds only the missing piece:
// one pair record per night visit — the visit reference, the date,
// the two staff names, the area, and the return time recorded after
// the visit.
//
// One pair record: the id, the visit reference, a strict calendar
// date, two staff names, the area, the return time (recorded after
// the visit, empty until then), and dated annotations.
//
// The fences, stated plainly:
//   - This records pairing only. It does not replace the field
//     safety note (Plan 153), which records a safety note, and it
//     is not the on-call rota (Plan 154), which records who is on
//     call: those modules are neither read nor rewritten here, and
//     this module imports nothing.
//   - Every night visit in a period should have a pair record with
//     two names, and night visits without one are listed as
//     exceptions by unpairedNightVisits, from the caller-supplied
//     visit list.
//   - A pair record is never edited, only annotated after the
//     visit: there is no edit function, only record, annotate,
//     record a return time, and remove. An annotation never
//     rewrites the visit reference, the date, the two staff names,
//     the area, or the return time. The return time is recorded
//     once, after the visit, and is never overwritten.
//   - Recording a pair never changes any bill, payment, customer,
//     visit, or staff record by itself: the module takes no bill,
//     payment, customer, visit, or staff object in, edits none,
//     and returns none. It holds pair records only.
//   - Inputs are never mutated, and the module never reads storage,
//     the clock, the network, or the page.

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export const NIGHT_VISIT_PAIR_STORE = 'shahdara_night_visit_pairs_v1';
export const NIGHT_VISIT_PAIR_FILENAME = 'night-visit-pairs.csv';

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function validNightVisitPairDate(value) {
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

export function validNightVisitPairReturnTime(value) {
  if (typeof value !== 'string') return false;
  const match = /^([01]\d|2[0-3]):[0-5]\d$/.exec(value.trim());
  return match !== null;
}

function cleanAnnotations(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const date = text(item.date);
    const note = text(item.note);
    if (!validNightVisitPairDate(date) || !note) continue;
    out.push({ date, note });
  }
  return out;
}

function normalizePair(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const id = text(entry.id);
  const visitRef = text(entry.visitRef);
  const date = text(entry.date);
  const staffA = text(entry.staffA);
  const staffB = text(entry.staffB);
  const area = text(entry.area);
  if (!id || !visitRef || !validNightVisitPairDate(date)) return null;
  if (!staffA || !staffB) return null;
  if (staffA.toLowerCase() === staffB.toLowerCase()) return null;
  if (!area) return null;
  const rawReturn = text(entry.returnTime);
  const returnTime =
    rawReturn !== '' && validNightVisitPairReturnTime(rawReturn)
      ? rawReturn
      : '';
  return {
    id,
    visitRef,
    date,
    staffA,
    staffB,
    area,
    returnTime,
    annotations: cleanAnnotations(entry.annotations),
  };
}

export function normalizeNightVisitPairList(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const entry of list) {
    const clean = normalizePair(entry);
    if (!clean) continue;
    if (seen.has(clean.id)) continue;
    seen.add(clean.id);
    out.push(clean);
  }
  return out;
}

export function recordNightVisitPair(list, entry) {
  const clean = normalizePair(entry);
  if (!clean) return null;
  const base = normalizeNightVisitPairList(list);
  if (base.some((item) => item.id === clean.id)) return base;
  return [...base, clean];
}

export function removeNightVisitPair(list, id) {
  const base = normalizeNightVisitPairList(list);
  return base.filter((item) => item.id !== text(id));
}

export function findNightVisitPair(list, id) {
  const base = normalizeNightVisitPairList(list);
  return base.find((item) => item.id === text(id)) || null;
}

export function addNightVisitPairAnnotation(list, id, annotation) {
  const base = normalizeNightVisitPairList(list);
  const target = text(id);
  if (!annotation || typeof annotation !== 'object') return list;
  const date = text(annotation.date);
  const note = text(annotation.note);
  if (!validNightVisitPairDate(date) || !note) return list;
  if (!base.some((item) => item.id === target)) return list;
  return base.map((item) =>
    item.id === target
      ? { ...item, annotations: [...item.annotations, { date, note }] }
      : item,
  );
}

// The return time is recorded once, after the visit, as a dated
// follow-up: it is never overwritten, and it is added as an
// annotation so the record shows when the return was noted.
export function recordNightVisitReturn(list, id, returnTime, date) {
  const base = normalizeNightVisitPairList(list);
  const target = text(id);
  const when = text(returnTime);
  const on = text(date);
  if (!validNightVisitPairReturnTime(when) || !validNightVisitPairDate(on)) {
    return list;
  }
  const item = base.find((row) => row.id === target);
  if (!item || item.returnTime !== '') return list;
  return base.map((row) =>
    row.id === target
      ? {
          ...row,
          returnTime: when,
          annotations: [
            ...row.annotations,
            { date: on, note: `Returned at ${when}.` },
          ],
        }
      : row,
  );
}

export function nightVisitPairSorted(list) {
  const base = normalizeNightVisitPairList(list);
  return [...base].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    const byRef = a.visitRef
      .toLowerCase()
      .localeCompare(b.visitRef.toLowerCase());
    if (byRef !== 0) return byRef;
    return a.id.localeCompare(b.id);
  });
}

export function nightVisitPairsInPeriod(list, from, to) {
  const fromDate = validNightVisitPairDate(text(from)) ? text(from) : '';
  const toDate = validNightVisitPairDate(text(to)) ? text(to) : '';
  return nightVisitPairSorted(list).filter((item) => {
    if (fromDate !== '' && item.date < fromDate) return false;
    if (toDate !== '' && item.date > toDate) return false;
    return true;
  });
}

export function nightVisitPairsForArea(list, area) {
  const wanted = text(area).toLowerCase();
  if (!wanted) return [];
  return nightVisitPairSorted(list).filter(
    (item) => item.area.toLowerCase() === wanted,
  );
}

export function nightVisitPairAreas(list) {
  const base = normalizeNightVisitPairList(list);
  const seen = new Map();
  for (const item of base) {
    const key = item.area.toLowerCase();
    if (!seen.has(key)) seen.set(key, item.area);
  }
  return [...seen.values()].sort((a, b) =>
    a.toLowerCase().localeCompare(b.toLowerCase()),
  );
}

function normalizeVisitRow(row) {
  if (!row || typeof row !== 'object') return null;
  const visitRef = text(row.visitRef);
  const date = text(row.date);
  if (!visitRef || !validNightVisitPairDate(date)) return null;
  return { visitRef, date };
}

// Night visits in the period with no pair record are the
// exceptions: every night visit should have a pair record with two
// names. The visit list is supplied by the caller; this module
// never reads any visit record itself.
export function unpairedNightVisits(visits, pairs, from, to) {
  if (!Array.isArray(visits)) return [];
  const fromDate = validNightVisitPairDate(text(from)) ? text(from) : '';
  const toDate = validNightVisitPairDate(text(to)) ? text(to) : '';
  const pairedRefs = new Set(
    normalizeNightVisitPairList(pairs).map((item) =>
      item.visitRef.toLowerCase(),
    ),
  );
  const seen = new Set();
  const out = [];
  for (const row of visits) {
    const clean = normalizeVisitRow(row);
    if (!clean) continue;
    if (fromDate !== '' && clean.date < fromDate) continue;
    if (toDate !== '' && clean.date > toDate) continue;
    if (pairedRefs.has(clean.visitRef.toLowerCase())) continue;
    const key = clean.visitRef.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(clean);
  }
  return out.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.visitRef.toLowerCase().localeCompare(b.visitRef.toLowerCase());
  });
}

export function nightVisitPairSummaryText(list) {
  const base = normalizeNightVisitPairList(list);
  const areas = nightVisitPairAreas(base);
  const returned = base.filter((item) => item.returnTime !== '').length;
  const pairWord = base.length === 1 ? 'pair record' : 'pair records';
  const areaWord = areas.length === 1 ? 'area' : 'areas';
  return (
    `${base.length} night visit ${pairWord} for ${areas.length} ${areaWord}. ` +
    `${returned} with a return time recorded.`
  );
}

export function unpairedNightVisitSummaryText(visits, pairs, from, to) {
  const missing = unpairedNightVisits(visits, pairs, from, to);
  const visitWord = missing.length === 1 ? 'night visit' : 'night visits';
  return missing.length === 0
    ? 'No unpaired night visits in the period.'
    : `${missing.length} unpaired ${visitWord} in the period: ${missing
        .map((row) => row.visitRef)
        .join(', ')}.`;
}

export function nightVisitPairText(pair) {
  const clean = normalizePair(pair);
  if (!clean) return '';
  const returned =
    clean.returnTime !== ''
      ? `Returned at ${clean.returnTime}.`
      : 'Return time not yet recorded.';
  return (
    `Night visit ${clean.visitRef} — ${clean.date} — ${clean.area} — ` +
    `paired: ${clean.staffA} and ${clean.staffB}. ${returned}`
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

export function nightVisitPairHtml(list) {
  const rows = nightVisitPairSorted(list);
  if (rows.length === 0) return '<p>No night visit pair records.</p>';
  const items = rows
    .map((item) => `<li>${escapeHtml(nightVisitPairText(item))}</li>`)
    .join('');
  return `<ul>${items}</ul>`;
}

function csvCell(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

export function nightVisitPairCsv(list) {
  const rows = nightVisitPairSorted(list);
  const header = [
    'id',
    'visit reference',
    'date',
    'staff a',
    'staff b',
    'area',
    'return time',
  ]
    .map(csvCell)
    .join(',');
  const lines = rows.map((item) =>
    [
      item.id,
      item.visitRef,
      item.date,
      item.staffA,
      item.staffB,
      item.area,
      item.returnTime,
    ]
      .map(csvCell)
      .join(','),
  );
  return [header, ...lines].join('\n');
}

export function nightVisitPairFilename() {
  return NIGHT_VISIT_PAIR_FILENAME;
}
