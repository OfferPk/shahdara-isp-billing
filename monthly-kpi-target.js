// Monthly KPI target record (Plan 346): one target record per KPI per
// month, so a month's figures can be compared with a target instead of
// standing alone. A record names the KPI, the target figure, the month,
// who set it, and the date it was set. A target set after the month ends
// is flagged as late, never hidden. Each target sits beside its actual
// figure from the caller-supplied monthly figures with the difference
// shown in plain words. The record only records targets: it never changes
// any actual figure, bill, or payment. It is distinct from the yearly
// owner-wide goals record, which covers a whole year. Inputs are never
// mutated, and the module never reads storage, the clock, the network,
// or the page.

const MONTHLY_KPI_TARGET_DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function isMonthlyKpiTargetLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function validMonthlyKpiTargetDay(value) {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12) return false;
  let lastDay = MONTHLY_KPI_TARGET_DAYS_IN_MONTH[month - 1];
  if (month === 2 && isMonthlyKpiTargetLeapYear(year)) lastDay = 29;
  return day >= 1 && day <= lastDay;
}

export function validMonthlyKpiTargetMonth(value) {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) return false;
  const month = Number(match[2]);
  return month >= 1 && month <= 12;
}

export function monthlyKpiTargetMonthEnd(month) {
  if (!validMonthlyKpiTargetMonth(month)) return null;
  const year = Number(month.slice(0, 4));
  const monthNumber = Number(month.slice(5, 7));
  let lastDay = MONTHLY_KPI_TARGET_DAYS_IN_MONTH[monthNumber - 1];
  if (monthNumber === 2 && isMonthlyKpiTargetLeapYear(year)) lastDay = 29;
  return `${month}-${String(lastDay).padStart(2, '0')}`;
}

export function normalizeMonthlyKpiTargetFigure(value) {
  if (typeof value === 'number') {
    if (!Number.isInteger(value) || value < 0) return null;
    return value;
  }
  if (typeof value === 'string') {
    const clean = value.trim();
    if (!/^\d+$/.test(clean)) return null;
    return Number(clean);
  }
  return null;
}

function cleanMonthlyKpiTargetText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function normalizeMonthlyKpiTarget(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = cleanMonthlyKpiTargetText(raw.id);
  const kpiName = cleanMonthlyKpiTargetText(raw.kpiName);
  const targetFigure = normalizeMonthlyKpiTargetFigure(raw.targetFigure);
  const month = cleanMonthlyKpiTargetText(raw.month);
  const setBy = cleanMonthlyKpiTargetText(raw.setBy);
  const dateSet = cleanMonthlyKpiTargetText(raw.dateSet);
  if (!id || !kpiName) return null;
  if (targetFigure === null) return null;
  if (!validMonthlyKpiTargetMonth(month)) return null;
  if (!setBy) return null;
  if (!validMonthlyKpiTargetDay(dateSet)) return null;
  return { id, kpiName, targetFigure, month, setBy, dateSet };
}

export function normalizeMonthlyKpiTargetList(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const raw of list) {
    const clean = normalizeMonthlyKpiTarget(raw);
    if (clean) out.push(clean);
  }
  return out;
}

export function recordMonthlyKpiTarget(list, entry) {
  const clean = normalizeMonthlyKpiTarget(entry);
  if (!clean) return list;
  const known = normalizeMonthlyKpiTargetList(list);
  if (known.some((item) => item.id === clean.id)) return list;
  if (known.some((item) => item.kpiName.toLowerCase() === clean.kpiName.toLowerCase() && item.month === clean.month)) return list;
  return [...known, clean];
}

export function monthlyKpiTargetFor(list, kpiName, month) {
  const known = normalizeMonthlyKpiTargetList(list);
  const wanted = cleanMonthlyKpiTargetText(kpiName).toLowerCase();
  const wantedMonth = cleanMonthlyKpiTargetText(month);
  return known.find((item) => item.kpiName.toLowerCase() === wanted && item.month === wantedMonth) ?? null;
}

export function monthlyKpiTargetIsLate(target) {
  const clean = normalizeMonthlyKpiTarget(target);
  if (!clean) return false;
  const end = monthlyKpiTargetMonthEnd(clean.month);
  return clean.dateSet > end;
}

function monthlyKpiTargetCompare(a, b) {
  if (a.month !== b.month) return a.month < b.month ? -1 : 1;
  const nameA = a.kpiName.toLowerCase();
  const nameB = b.kpiName.toLowerCase();
  if (nameA !== nameB) return nameA < nameB ? -1 : 1;
  if (a.id !== b.id) return a.id < b.id ? -1 : 1;
  return 0;
}

export function monthlyKpiTargetLate(list) {
  const known = normalizeMonthlyKpiTargetList(list);
  return known.filter(monthlyKpiTargetIsLate).sort(monthlyKpiTargetCompare);
}

function normalizeMonthlyKpiTargetActual(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const kpiName = cleanMonthlyKpiTargetText(raw.kpiName);
  const month = cleanMonthlyKpiTargetText(raw.month);
  const figure = normalizeMonthlyKpiTargetFigure(raw.figure);
  if (!kpiName || !validMonthlyKpiTargetMonth(month) || figure === null) return null;
  return { kpiName, month, figure };
}

export function monthlyKpiTargetComparison(list, actuals) {
  const known = normalizeMonthlyKpiTargetList(list);
  const actualList = Array.isArray(actuals)
    ? actuals.map(normalizeMonthlyKpiTargetActual).filter((item) => item !== null)
    : [];
  return [...known].sort(monthlyKpiTargetCompare).map((target) => {
    const actual = actualList.find(
      (item) => item.kpiName.toLowerCase() === target.kpiName.toLowerCase() && item.month === target.month,
    );
    const actualFigure = actual ? actual.figure : null;
    const difference = actualFigure === null ? null : actualFigure - target.targetFigure;
    return { target, actualFigure, difference, late: monthlyKpiTargetIsLate(target) };
  });
}

export function monthlyKpiTargetDifferenceText(difference) {
  if (difference === null || difference === undefined) return 'No actual figure yet';
  if (difference === 0) return 'On target';
  if (difference > 0) return `${difference} above target`;
  return `${-difference} below target`;
}

export function monthlyKpiTargetCounts(list) {
  const known = normalizeMonthlyKpiTargetList(list);
  let late = 0;
  for (const item of known) {
    if (monthlyKpiTargetIsLate(item)) late += 1;
  }
  return { total: known.length, late, onTime: known.length - late };
}

export function monthlyKpiTargetSummaryText(list) {
  const counts = monthlyKpiTargetCounts(list);
  if (counts.total === 0) return 'No monthly KPI targets recorded.';
  if (counts.late === 0) {
    return `${counts.total} monthly KPI target${counts.total === 1 ? '' : 's'} recorded, all set on time.`;
  }
  return `${counts.total} monthly KPI target${counts.total === 1 ? '' : 's'} recorded, ${counts.late} set late — flagged below.`;
}

export function monthlyKpiTargetText(item) {
  const late = monthlyKpiTargetIsLate(item) ? ' — set late' : '';
  return `${item.kpiName} (${item.month}): target ${item.targetFigure}, set by ${item.setBy} on ${item.dateSet}${late}`;
}

export function monthlyKpiTargetComparisonText(entry) {
  const base = monthlyKpiTargetText(entry.target);
  const actual = entry.actualFigure === null ? 'not recorded' : String(entry.actualFigure);
  return `${base} — actual ${actual}, ${monthlyKpiTargetDifferenceText(entry.difference)}`;
}

function escapeMonthlyKpiTargetHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function monthlyKpiTargetHtml(item) {
  const late = monthlyKpiTargetIsLate(item) ? ' — <strong>set late</strong>' : '';
  return `<li>${escapeMonthlyKpiTargetHtml(item.kpiName)} (${escapeMonthlyKpiTargetHtml(item.month)}): target ${item.targetFigure}, set by ${escapeMonthlyKpiTargetHtml(item.setBy)} on ${escapeMonthlyKpiTargetHtml(item.dateSet)}${late}</li>`;
}

export function monthlyKpiTargetsHtml(list) {
  const known = normalizeMonthlyKpiTargetList(list);
  const items = [...known].sort(monthlyKpiTargetCompare).map(monthlyKpiTargetHtml).join('');
  return `<ul>${items}</ul>`;
}

export function monthlyKpiTargetLateHtml(list) {
  const items = monthlyKpiTargetLate(list).map(monthlyKpiTargetHtml).join('');
  return `<ul>${items}</ul>`;
}

export function monthlyKpiTargetComparisonHtml(list, actuals) {
  const entries = monthlyKpiTargetComparison(list, actuals);
  const items = entries.map((entry) => `<li>${escapeMonthlyKpiTargetHtml(monthlyKpiTargetComparisonText(entry))}</li>`).join('');
  return `<ul>${items}</ul>`;
}

function monthlyKpiTargetCsvCell(value) {
  const text = String(value ?? '');
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function monthlyKpiTargetCsv(list) {
  const known = normalizeMonthlyKpiTargetList(list);
  const header = ['id', 'kpiName', 'targetFigure', 'month', 'setBy', 'dateSet', 'late'];
  const lines = [header.map(monthlyKpiTargetCsvCell).join(',')];
  for (const item of [...known].sort(monthlyKpiTargetCompare)) {
    lines.push([
      item.id,
      item.kpiName,
      item.targetFigure,
      item.month,
      item.setBy,
      item.dateSet,
      monthlyKpiTargetIsLate(item) ? 'yes' : 'no',
    ].map(monthlyKpiTargetCsvCell).join(','));
  }
  return lines.join('\n');
}

export function monthlyKpiTargetFilename() {
  return 'monthly-kpi-target.csv';
}
