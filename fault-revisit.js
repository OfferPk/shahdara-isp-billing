// Plan 240 — Fault revisit pattern per segment.
//
// A read-only pattern view composed from fault records supplied by the
// caller. One pattern per segment: the segment reference, the fault count
// in a chosen period, the dates of the faults, and the customers affected.
// Segments can be ordered by revisit count.
//
// The view itself is never edited: there is no edit, record, or remove
// function here, only pure composition over caller-supplied rows. Viewing
// a pattern never changes any bill, payment, customer, or fault record
// by itself. This module does not replace the repeat-fault flag (Plan 24)
// or the segment fault history (Plan 133); neither of those is read or
// rewritten here, and this module imports nothing.

const FAULT_REVISIT_DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function faultRevisitIsLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function validFaultRevisitDate(value) {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12) return false;
  let limit = FAULT_REVISIT_DAYS_IN_MONTH[month - 1];
  if (month === 2 && faultRevisitIsLeapYear(year)) limit = 29;
  return day >= 1 && day <= limit;
}

function faultRevisitText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function faultRevisitCompareText(a, b) {
  const lowerA = a.toLowerCase();
  const lowerB = b.toLowerCase();
  if (lowerA < lowerB) return -1;
  if (lowerA > lowerB) return 1;
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

// Keep only well-formed fault rows. A row needs an id, a segment, and a
// strict date; the customer is optional. Unknown fields are dropped, a
// second row with the same id never rewrites the first, and the input
// list is never mutated.
export function normalizeFaultRevisitList(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const row of list) {
    if (!row || typeof row !== 'object') continue;
    const id = faultRevisitText(row.id);
    const segment = faultRevisitText(row.segment);
    const date = faultRevisitText(row.date);
    if (!id || !segment || !validFaultRevisitDate(date)) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({ id, segment, date, customer: faultRevisitText(row.customer) });
  }
  return out;
}

function faultRevisitPeriodIsGood(from, to) {
  if (!validFaultRevisitDate(from) || !validFaultRevisitDate(to)) return false;
  return from <= to;
}

// Fault rows inside a period, inclusive at both ends. A bad or reversed
// period yields nothing, never a guessed list.
export function faultRevisitInPeriod(list, from, to) {
  if (!faultRevisitPeriodIsGood(from, to)) return [];
  const clean = normalizeFaultRevisitList(list);
  return clean.filter((row) => row.date >= from && row.date <= to);
}

function faultRevisitSortedRows(rows) {
  return [...rows].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    if (a.id !== b.id) return a.id < b.id ? -1 : 1;
    return 0;
  });
}

// The pattern for one segment in one period, or null when the segment
// is blank or the period is bad. The count always matches the fault
// rows for that segment in the same period, because it is counted from
// those very rows.
export function faultRevisitPattern(list, segment, from, to) {
  const wanted = faultRevisitText(segment);
  if (!wanted || !faultRevisitPeriodIsGood(from, to)) return null;
  const rows = faultRevisitInPeriod(list, from, to).filter(
    (row) => row.segment.toLowerCase() === wanted.toLowerCase(),
  );
  const ordered = faultRevisitSortedRows(rows);
  const customers = [];
  for (const row of ordered) {
    if (row.customer && !customers.some((c) => c.toLowerCase() === row.customer.toLowerCase())) {
      customers.push(row.customer);
    }
  }
  customers.sort(faultRevisitCompareText);
  return {
    segment: rows.length ? rows[0].segment : wanted,
    count: ordered.length,
    dates: ordered.map((row) => row.date),
    customers,
    repeat: ordered.length >= 2,
  };
}

// Every segment with at least one fault in the period, ordered by
// revisit count (highest first), then segment A-Z.
export function faultRevisitPatterns(list, from, to) {
  if (!faultRevisitPeriodIsGood(from, to)) return [];
  const rows = faultRevisitInPeriod(list, from, to);
  const segments = [];
  for (const row of rows) {
    if (!segments.some((s) => s.toLowerCase() === row.segment.toLowerCase())) {
      segments.push(row.segment);
    }
  }
  const patterns = segments
    .map((segment) => faultRevisitPattern(list, segment, from, to))
    .filter(Boolean);
  patterns.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return faultRevisitCompareText(a.segment, b.segment);
  });
  return patterns;
}

// Only the segments that actually revisit: two or more faults in the
// period. A segment with a single fault has no pattern to notice yet.
export function faultRevisitRepeats(list, from, to) {
  return faultRevisitPatterns(list, from, to).filter((pattern) => pattern.repeat);
}

export function faultRevisitSegments(list) {
  const clean = normalizeFaultRevisitList(list);
  const segments = [];
  for (const row of clean) {
    if (!segments.some((s) => s.toLowerCase() === row.segment.toLowerCase())) {
      segments.push(row.segment);
    }
  }
  segments.sort(faultRevisitCompareText);
  return segments;
}

export function faultRevisitPatternText(pattern) {
  if (!pattern) return 'No pattern to show.';
  const dates = pattern.dates.length ? pattern.dates.join(', ') : 'No fault dates.';
  const customers = pattern.customers.length
    ? pattern.customers.join(', ')
    : 'No customers noted.';
  const repeat = pattern.repeat ? ' Revisit pattern: this segment failed more than once.' : '';
  return `Segment ${pattern.segment}: ${pattern.count} fault(s) — dates: ${dates}. Customers affected: ${customers}.${repeat}`;
}

export function faultRevisitSummaryText(list, from, to) {
  if (!faultRevisitPeriodIsGood(from, to)) {
    return 'No pattern to show: give a real period, from date on or before to date.';
  }
  const patterns = faultRevisitPatterns(list, from, to);
  const repeats = patterns.filter((pattern) => pattern.repeat);
  const total = patterns.reduce((sum, pattern) => sum + pattern.count, 0);
  return `${patterns.length} segment(s) with ${total} fault(s) in the period; ${repeats.length} segment(s) with a revisit pattern.`;
}

function faultRevisitEscape(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function faultRevisitHtml(pattern) {
  if (!pattern) return '<p>No pattern to show.</p>';
  return `<p>Segment ${faultRevisitEscape(pattern.segment)}: ${pattern.count} fault(s) — dates: ${faultRevisitEscape(pattern.dates.join(', ') || 'No fault dates.')} — customers: ${faultRevisitEscape(pattern.customers.join(', ') || 'No customers noted.')}</p>`;
}

function faultRevisitCsvCell(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

export function faultRevisitCsv(patterns) {
  const rows = Array.isArray(patterns) ? patterns : [];
  const lines = ['Segment,Fault count,Dates,Customers affected,Revisit pattern'];
  for (const pattern of rows) {
    lines.push([
      faultRevisitCsvCell(pattern.segment),
      faultRevisitCsvCell(pattern.count),
      faultRevisitCsvCell(pattern.dates.join('; ')),
      faultRevisitCsvCell(pattern.customers.join('; ')),
      faultRevisitCsvCell(pattern.repeat ? 'Yes' : 'No'),
    ].join(','));
  }
  return lines.join('\n');
}

export function faultRevisitFilename() {
  return 'fault-revisit-patterns.csv';
}
