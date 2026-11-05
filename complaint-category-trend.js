// Plan 273 (Plan 203-350) — Customer complaint category trend.
//
// Complaints are logged, but their categories over time are not counted,
// so nobody knows whether billing, service, or behaviour complaints are
// rising. This module is the TREND VIEW for that question: one category
// trend view per period, composed from caller-supplied complaint rows
// only — a category, a count, and the change from the previous period.
// Counts for a period always sum to that period's complaints on the same
// rows, and a category with no complaints in the period shows zero.
//
// What this module is NOT, stated plainly:
//   - It is not a complaint record. Complaints are recorded elsewhere,
//     and no record is read or written here: the caller supplies every
//     row, and this module imports nothing.
//   - It is not the billing-dispute letters. Those letters belong to
//     billing disputes only; this trend covers complaints of every kind.
//   - It is not the fault root-cause catalogue. Root causes explain why
//     a fault happened; this trend only counts complaint categories.
//   - It is not a score. Counts are simple totals only — how many
//     complaints per category, and how many more or fewer than the
//     previous period — never a blended score, average, or percentage.
//   - It is not proof that a category really rose. The view says what
//     the supplied rows say; the module verifies format and ordering,
//     not truth.
//   - Viewing a trend never changes any complaint, bill, or payment
//     record. There is no record, edit, or remove function here at all:
//     this module only reads the rows it is given.
//
// How the module keeps those fences:
//   - It is pure and import-free: no storage, no clock, no network.
//   - A row is a category in plain words + a strict date. Bad rows are
//     dropped, never guessed at, and the caller's list is never mutated.
//   - Categories fold case-insensitively and keep the first spelling,
//     so "Billing" and "billing" count as one category.
//   - The previous period is the same number of days immediately before
//     the period, worked out with plain day arithmetic — no clock, no
//     calendar object. A category seen in the previous period but not in
//     this one still appears, with a count of zero.

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isLeapYear(year) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function daysInMonth(year, month) {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return DAYS_IN_MONTH[month - 1];
}

export function validComplaintCategoryTrendDate(value) {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > daysInMonth(year, month)) return false;
  return true;
}

// Day number for a strict date: days since 0000-01-01. Plain arithmetic,
// so the previous period can be worked out without any clock.
function dateToOrdinal(value) {
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  const yearsBefore = year - 1;
  let days = yearsBefore * 365
    + Math.floor(yearsBefore / 4)
    - Math.floor(yearsBefore / 100)
    + Math.floor(yearsBefore / 400);
  for (let m = 1; m < month; m++) days += daysInMonth(year, m);
  return days + day;
}

function ordinalToDate(ordinal) {
  let year = Math.floor(ordinal / 365.2425);
  if (year < 1) year = 1;
  while (dateToOrdinal(`${String(year + 1).padStart(4, '0')}-01-01`) <= ordinal) year++;
  while (dateToOrdinal(`${String(year).padStart(4, '0')}-01-01`) > ordinal) year--;
  let remaining = ordinal - dateToOrdinal(`${String(year).padStart(4, '0')}-01-01`) + 1;
  let month = 1;
  while (remaining > daysInMonth(year, month)) {
    remaining -= daysInMonth(year, month);
    month++;
  }
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(remaining).padStart(2, '0')}`;
}

export function normalizeComplaintCategoryTrendRow(row) {
  if (!row || typeof row !== 'object') return null;
  const category = cleanText(row.category);
  const date = cleanText(row.date);
  if (!category) return null;
  if (!validComplaintCategoryTrendDate(date)) return null;
  return { category, date };
}

export function normalizeComplaintCategoryTrendRows(list) {
  if (!Array.isArray(list)) return [];
  const rows = [];
  for (const row of list) {
    const clean = normalizeComplaintCategoryTrendRow(row);
    if (clean) rows.push(clean);
  }
  return rows;
}

export function validComplaintCategoryTrendPeriod(from, to) {
  return validComplaintCategoryTrendDate(from)
    && validComplaintCategoryTrendDate(to)
    && from <= to;
}

export function complaintCategoryTrendInPeriod(rows, from, to) {
  if (!validComplaintCategoryTrendPeriod(from, to)) return [];
  return normalizeComplaintCategoryTrendRows(rows)
    .filter((row) => row.date >= from && row.date <= to);
}

// The previous period: the same number of days immediately before `from`.
export function previousComplaintCategoryTrendPeriod(from, to) {
  if (!validComplaintCategoryTrendPeriod(from, to)) return null;
  const length = dateToOrdinal(to) - dateToOrdinal(from) + 1;
  const prevTo = ordinalToDate(dateToOrdinal(from) - 1);
  const prevFrom = ordinalToDate(dateToOrdinal(prevTo) - length + 1);
  return { from: prevFrom, to: prevTo };
}

function countByCategory(rows) {
  const counts = new Map();
  for (const row of rows) {
    const key = row.category.toLowerCase();
    if (counts.has(key)) {
      counts.get(key).count++;
    } else {
      counts.set(key, { category: row.category, count: 1 });
    }
  }
  return counts;
}

export function complaintCategoryTrend(rows, from, to) {
  if (!validComplaintCategoryTrendPeriod(from, to)) return null;
  const prev = previousComplaintCategoryTrendPeriod(from, to);
  const currentRows = complaintCategoryTrendInPeriod(rows, from, to);
  const prevRows = complaintCategoryTrendInPeriod(rows, prev.from, prev.to);
  const current = countByCategory(currentRows);
  const previous = countByCategory(prevRows);
  const keys = new Set([...current.keys(), ...previous.keys()]);
  const categories = [...keys].map((key) => {
    const entry = current.get(key) ?? { category: previous.get(key).category, count: 0 };
    const prevCount = previous.get(key)?.count ?? 0;
    return {
      category: entry.category,
      count: entry.count,
      prevCount,
      change: entry.count - prevCount,
    };
  });
  categories.sort((a, b) => (b.count - a.count) || (a.category.toLowerCase() < b.category.toLowerCase() ? -1 : 1));
  const total = currentRows.length;
  const prevTotal = prevRows.length;
  return {
    from,
    to,
    prevFrom: prev.from,
    prevTo: prev.to,
    total,
    prevTotal,
    change: total - prevTotal,
    categories,
  };
}

// One category on its own: a category with no complaints in the period
// shows zero, not a blank.
export function complaintCategoryTrendFor(rows, category, from, to) {
  const wanted = cleanText(category);
  if (!wanted) return null;
  const trend = complaintCategoryTrend(rows, from, to);
  if (!trend) return null;
  const found = trend.categories.find((entry) => entry.category.toLowerCase() === wanted.toLowerCase());
  const entry = found ?? { category: wanted, count: 0, prevCount: 0, change: 0 };
  return {
    category: entry.category,
    count: entry.count,
    prevCount: entry.prevCount,
    change: entry.change,
    hasComplaints: entry.count > 0,
    from: trend.from,
    to: trend.to,
    prevFrom: trend.prevFrom,
    prevTo: trend.prevTo,
  };
}

function changeText(change) {
  if (change > 0) return `up ${change} from the previous period`;
  if (change < 0) return `down ${Math.abs(change)} from the previous period`;
  return 'unchanged from the previous period';
}

export function complaintCategoryTrendText(trend) {
  if (!trend) return 'No complaint category trend for this period.';
  if (!trend.categories.length) {
    return `No complaints recorded from ${trend.from} to ${trend.to}.`;
  }
  const lines = trend.categories.map((entry) => {
    const word = entry.count === 1 ? 'complaint' : 'complaints';
    return `${entry.category}: ${entry.count} ${word}, ${changeText(entry.change)}`;
  });
  return `Complaint categories from ${trend.from} to ${trend.to} (${trend.total} in total, ${changeText(trend.change)}): ${lines.join('; ')}.`;
}

export function complaintCategoryTrendCategoryText(view) {
  if (!view) return 'Give a category and a real period to see its trend.';
  if (!view.hasComplaints) {
    return `No complaints recorded for ${view.category} from ${view.from} to ${view.to}.`;
  }
  const word = view.count === 1 ? 'complaint' : 'complaints';
  return `${view.category}: ${view.count} ${word} from ${view.from} to ${view.to}, ${changeText(view.change)}.`;
}

export function complaintCategoryTrendSummaryText(rows, from, to) {
  const trend = complaintCategoryTrend(rows, from, to);
  if (!trend) return 'Give a real period to see the complaint category trend.';
  if (!trend.categories.length) {
    return `No complaints recorded from ${trend.from} to ${trend.to}.`;
  }
  const rising = trend.categories.filter((entry) => entry.change > 0);
  const top = trend.categories[0];
  const risingText = rising.length
    ? ` Rising: ${rising.map((entry) => `${entry.category} (+${entry.change})`).join(', ')}.`
    : ' No category is rising.';
  return `${trend.total} complaints from ${trend.from} to ${trend.to} across ${trend.categories.length} categor${trend.categories.length === 1 ? 'y' : 'ies'}. Most complaints: ${top.category} (${top.count}).${risingText}`;
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function complaintCategoryTrendCategoryHtml(view) {
  if (!view) return '<p>Give a category and a real period to see its trend.</p>';
  return `<p>${escapeHtml(complaintCategoryTrendCategoryText(view))}</p>`;
}

export function complaintCategoryTrendHtml(trend) {
  if (!trend) return '<p>Give a real period to see the complaint category trend.</p>';
  if (!trend.categories.length) {
    return `<p>No complaints recorded from ${escapeHtml(trend.from)} to ${escapeHtml(trend.to)}.</p>`;
  }
  const rows = trend.categories.map((entry) => {
    const word = entry.count === 1 ? 'complaint' : 'complaints';
    const change = entry.change > 0 ? `+${entry.change}` : String(entry.change);
    return `<li>${escapeHtml(entry.category)}: ${entry.count} ${word} (${change} from the previous period, ${entry.prevCount} before)</li>`;
  }).join('');
  return `<p>Complaint categories from ${escapeHtml(trend.from)} to ${escapeHtml(trend.to)}: ${trend.total} in total (${trend.change > 0 ? '+' : ''}${trend.change} from the previous period).</p><ul>${rows}</ul>`;
}

export function complaintCategoryTrendCsv(trend) {
  if (!trend) return 'category,count,previous count,change,period from,period to\n';
  const lines = ['category,count,previous count,change,period from,period to'];
  for (const entry of trend.categories) {
    const cell = `"${String(entry.category).replace(/"/g, '""')}"`;
    lines.push(`${cell},${entry.count},${entry.prevCount},${entry.change},${trend.from},${trend.to}`);
  }
  return `${lines.join('\n')}\n`;
}

export function complaintCategoryTrendFilename() {
  return 'complaint-category-trends.csv';
}
