// Plan 202 (Plan 101-202) — Owner absence cover roster.
//
// When the owner is away, cover for shop decisions and supervision is
// arranged by word of mouth, so cover gaps are discovered only when
// something needs a decision. This module is that roster in writing:
// one record per cover period, with its cover person, from date, to
// date, scope of cover in plain words, and a handover-note reference.
//
// Scope fence, stated plainly:
//   - This records cover only. It never grants system permissions,
//     never reassigns routes, and never changes any bill, payment,
//     customer, or staff record by itself.
//   - It is NOT the on-call rota (oncall-rota.js), the field handover
//     notes (handover.js), or the staff handover notes
//     (staff-handover.js): those modules are neither read nor written
//     here. The handover-note reference here is only a reference the
//     operator types — this module never follows it into another
//     record, and recording cover never creates or changes a
//     handover note.
//   - It is import-free: the caller supplies every period and the
//     module never reads storage, the clock, or the network, and
//     never mutates an input.
//   - Dates are real YYYY-MM-DD calendar dates (2026-02-30 is
//     refused, never mapped onto a neighbouring date).
//   - Overlaps are flagged, never silently resolved: coverOverlaps
//     lists every pair of periods whose dates overlap, so the owner
//     can explain or fix them.
//   - Gaps are plainly visible: coverGaps lists every uncovered
//     stretch inside a chosen range, never pretending a gap is
//     covered.

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export function validCoverDate(value) {
  if (typeof value !== 'string') return false;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return false;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1) return false;
  let limit = DAYS_IN_MONTH[month - 1];
  if (month === 2 && (year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0))) limit = 29;
  return day <= limit;
}

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

// Pure civil-date arithmetic (no clock, no timezone): day numbers count
// days since 1970-01-01, converted with the standard era algorithm.
function floorDiv(a, b) {
  return Math.floor(a / b);
}

function dayNumber(value) {
  let [year, month, day] = value.split('-').map(Number);
  if (month <= 2) year -= 1;
  const era = floorDiv(year, 400);
  const yoe = year - era * 400;
  const mp = month > 2 ? month - 3 : month + 9;
  const doy = floorDiv(153 * mp + 2, 5) + day - 1;
  const doe = yoe * 365 + floorDiv(yoe, 4) - floorDiv(yoe, 100) + doy;
  return era * 146097 + doe - 719468;
}

function dateFromDayNumber(n) {
  const z = n + 719468;
  const era = floorDiv(z, 146097);
  const doe = z - era * 146097;
  const yoe = floorDiv(doe - floorDiv(doe, 1460) + floorDiv(doe, 36524) - floorDiv(doe, 146096), 365);
  let year = yoe + era * 400;
  const doy = doe - (365 * yoe + floorDiv(yoe, 4) - floorDiv(yoe, 100));
  const mp = floorDiv(5 * doy + 2, 153);
  const day = doy - floorDiv(153 * mp + 2, 5) + 1;
  const month = mp < 10 ? mp + 3 : mp - 9;
  if (month <= 2) year += 1;
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function normalizeCoverPeriod(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = cleanText(raw.id);
  const coverPerson = cleanText(raw.coverPerson);
  const fromDate = cleanText(raw.fromDate);
  const toDate = cleanText(raw.toDate);
  if (!id || !coverPerson || !validCoverDate(fromDate) || !validCoverDate(toDate)) return null;
  if (toDate < fromDate) return null;
  return {
    id,
    coverPerson,
    fromDate,
    toDate,
    scope: cleanText(raw.scope),
    handoverNoteRef: cleanText(raw.handoverNoteRef),
  };
}

export function normalizeCoverList(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of list) {
    const period = normalizeCoverPeriod(raw);
    if (!period || seen.has(period.id)) continue;
    seen.add(period.id);
    out.push(period);
  }
  return out;
}

export function findCoverPeriod(list, id) {
  const clean = cleanText(id);
  if (!clean) return null;
  return normalizeCoverList(list).find((period) => period.id === clean) ?? null;
}

export function recordCoverPeriod(list, period) {
  const clean = normalizeCoverList(list);
  const next = normalizeCoverPeriod(period);
  if (!next) return clean;
  if (clean.some((period) => period.id === next.id)) return clean;
  return [...clean, next];
}

export function removeCoverPeriod(list, id) {
  const clean = cleanText(id);
  if (!clean) return normalizeCoverList(list);
  return normalizeCoverList(list).filter((period) => period.id !== clean);
}

export function coverPeriodsSorted(list) {
  return normalizeCoverList(list).sort((a, b) => {
    if (a.fromDate !== b.fromDate) return a.fromDate < b.fromDate ? -1 : 1;
    if (a.toDate !== b.toDate) return a.toDate < b.toDate ? -1 : 1;
    const pa = a.coverPerson.toLowerCase();
    const pb = b.coverPerson.toLowerCase();
    if (pa !== pb) return pa < pb ? -1 : 1;
    return a.id.localeCompare(b.id);
  });
}

export function coverPeriodsForPerson(list, person) {
  const want = cleanText(person).toLowerCase();
  if (!want) return coverPeriodsSorted(list);
  return coverPeriodsSorted(list).filter((period) =>
    period.coverPerson.toLowerCase().includes(want));
}

export function coverPeriodsForDate(list, date) {
  const clean = cleanText(date);
  if (!validCoverDate(clean)) return [];
  return coverPeriodsSorted(list).filter((period) =>
    period.fromDate <= clean && clean <= period.toDate);
}

export function coverOverlaps(list) {
  const sorted = coverPeriodsSorted(list);
  const pairs = [];
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      const first = sorted[i];
      const second = sorted[j];
      if (first.fromDate <= second.toDate && second.fromDate <= first.toDate) {
        pairs.push({ first, second });
      }
    }
  }
  return pairs;
}

export function coverGaps(list, rangeStart, rangeEnd) {
  const start = cleanText(rangeStart);
  const end = cleanText(rangeEnd);
  if (!validCoverDate(start) || !validCoverDate(end) || end < start) return [];
  const startDay = dayNumber(start);
  const endDay = dayNumber(end);
  const intervals = coverPeriodsSorted(list)
    .map((period) => ({
      from: Math.max(dayNumber(period.fromDate), startDay),
      to: Math.min(dayNumber(period.toDate), endDay),
    }))
    .filter((interval) => interval.from <= interval.to)
    .sort((a, b) => a.from - b.from);
  const gaps = [];
  let cursor = startDay;
  for (const interval of intervals) {
    if (interval.from > cursor) {
      gaps.push({ fromDate: dateFromDayNumber(cursor), toDate: dateFromDayNumber(interval.from - 1) });
    }
    if (interval.to >= cursor) cursor = interval.to + 1;
  }
  if (cursor <= endDay) {
    gaps.push({ fromDate: dateFromDayNumber(cursor), toDate: dateFromDayNumber(endDay) });
  }
  return gaps;
}

export function coverSummaryText(list) {
  const clean = normalizeCoverList(list);
  if (!clean.length) return 'No cover periods recorded.';
  const people = new Set(clean.map((period) => period.coverPerson.toLowerCase())).size;
  const overlaps = coverOverlaps(list).length;
  const personWord = people === 1 ? 'person' : 'people';
  const overlapWord = overlaps === 1 ? 'overlap' : 'overlaps';
  return `${clean.length} cover ${clean.length === 1 ? 'period' : 'periods'} across ${people} ${personWord}, ${overlaps} ${overlapWord} flagged.`;
}

export function coverGapsText(list, rangeStart, rangeEnd) {
  const start = cleanText(rangeStart);
  const end = cleanText(rangeEnd);
  if (!validCoverDate(start) || !validCoverDate(end) || end < start) return '';
  const gaps = coverGaps(list, start, end);
  if (!gaps.length) return `No cover gaps from ${start} to ${end}.`;
  return `Cover gaps from ${start} to ${end}: ${gaps.map((gap) => `${gap.fromDate} to ${gap.toDate}`).join('; ')}.`;
}

export function coverPeriodText(period) {
  const clean = normalizeCoverPeriod(period);
  if (!clean) return '';
  const scope = clean.scope ? ` · ${clean.scope}` : '';
  const ref = clean.handoverNoteRef ? ` — Handover note: ${clean.handoverNoteRef}` : ' — No handover note reference.';
  return `${clean.coverPerson} · ${clean.fromDate} to ${clean.toDate}${scope}${ref}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export function coverPeriodHtml(period) {
  const clean = normalizeCoverPeriod(period);
  if (!clean) return '';
  const scope = clean.scope ? ` · ${escapeHtml(clean.scope)}` : '';
  const ref = clean.handoverNoteRef ? ` — Handover note: ${escapeHtml(clean.handoverNoteRef)}` : ' — No handover note reference.';
  return `<p>${escapeHtml(clean.coverPerson)} · ${escapeHtml(clean.fromDate)} to ${escapeHtml(clean.toDate)}${scope}${ref}</p>`;
}

export function coverAllHtml(list) {
  return coverPeriodsSorted(list).map(coverPeriodHtml).join('');
}

export function coverOverlapText(pair) {
  if (!pair || !normalizeCoverPeriod(pair.first) || !normalizeCoverPeriod(pair.second)) return '';
  return `Overlap: ${coverPeriodText(pair.first)} overlaps ${coverPeriodText(pair.second)}.`;
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function coverCsv(list) {
  const rows = [['id', 'cover_person', 'from_date', 'to_date', 'scope', 'handover_note_ref']];
  for (const period of coverPeriodsSorted(list)) {
    rows.push([period.id, period.coverPerson, period.fromDate, period.toDate, period.scope, period.handoverNoteRef]);
  }
  return rows.map((row) => row.map(csvCell).join(',')).join('\n');
}

export function coverFilename() {
  return 'absence-cover.csv';
}
