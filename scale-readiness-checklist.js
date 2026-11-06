// Scale readiness checklist (Plan 350): one checklist per review, so the
// jump from about 100 customers toward 250-300 is made on a checked list
// of gaps instead of optimism. Each review checks five areas — ports free,
// stock levels, collector capacity, route coverage, backup health — and
// each area is marked ready or as a named gap with a note. A checklist
// with any gap is marked not ready overall. The checklist only records
// readiness: it never installs equipment, hires anyone, or changes any
// port, stock, staff, bill, or payment record by itself. Inputs are never
// mutated, and the module never reads storage, the clock, the network, or
// the page.

const SCALE_READINESS_CHECKLIST_DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export const SCALE_READINESS_CHECKLIST_AREAS = [
  { key: 'portsFree', label: 'Ports free' },
  { key: 'stockLevels', label: 'Stock levels' },
  { key: 'collectorCapacity', label: 'Collector capacity' },
  { key: 'routeCoverage', label: 'Route coverage' },
  { key: 'backupHealth', label: 'Backup health' },
];

function isScaleReadinessChecklistLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function validScaleReadinessChecklistDay(value) {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12) return false;
  let lastDay = SCALE_READINESS_CHECKLIST_DAYS_IN_MONTH[month - 1];
  if (month === 2 && isScaleReadinessChecklistLeapYear(year)) lastDay = 29;
  return day >= 1 && day <= lastDay;
}

function cleanScaleReadinessChecklistText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function foldScaleReadinessChecklistStatus(value) {
  const text = cleanScaleReadinessChecklistText(value).toLowerCase();
  if (text === 'ready' || text === 'ok' || text === 'yes' || text === 'true' || text === 'pass') return 'ready';
  return 'gap';
}

function scaleReadinessChecklistAreaByKey(key) {
  const wanted = cleanScaleReadinessChecklistText(key).toLowerCase();
  if (!wanted) return null;
  return SCALE_READINESS_CHECKLIST_AREAS.find((area) => area.key.toLowerCase() === wanted) || null;
}

function normalizeScaleReadinessChecklistItem(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const area = scaleReadinessChecklistAreaByKey(raw.area || raw.key);
  if (!area) return null;
  const status = foldScaleReadinessChecklistStatus(raw.status);
  const note = cleanScaleReadinessChecklistText(raw.note);
  if (status === 'gap' && !note) return null;
  return { area: area.key, label: area.label, status, note };
}

function normalizeScaleReadinessChecklistItems(value) {
  const rawItems = [];
  if (Array.isArray(value)) {
    rawItems.push(...value);
  } else if (value && typeof value === 'object') {
    for (const [key, entry] of Object.entries(value)) {
      if (entry && typeof entry === 'object') {
        rawItems.push({ area: key, status: entry.status, note: entry.note });
      } else {
        rawItems.push({ area: key, status: entry, note: '' });
      }
    }
  } else {
    return null;
  }
  const seen = new Set();
  const byKey = new Map();
  for (const raw of rawItems) {
    const item = normalizeScaleReadinessChecklistItem(raw);
    if (!item) return null;
    if (seen.has(item.area)) return null;
    seen.add(item.area);
    byKey.set(item.area, item);
  }
  if (seen.size !== SCALE_READINESS_CHECKLIST_AREAS.length) return null;
  return SCALE_READINESS_CHECKLIST_AREAS.map((area) => byKey.get(area.key));
}

export function normalizeScaleReadinessChecklist(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = cleanScaleReadinessChecklistText(raw.id);
  const reviewDate = cleanScaleReadinessChecklistText(raw.reviewDate);
  const reviewer = cleanScaleReadinessChecklistText(raw.reviewer);
  if (!id) return null;
  if (!validScaleReadinessChecklistDay(reviewDate)) return null;
  if (!reviewer) return null;
  const items = normalizeScaleReadinessChecklistItems(raw.items);
  if (!items) return null;
  return { id, reviewDate, reviewer, items };
}

export function normalizeScaleReadinessChecklistList(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const raw of list) {
    const clean = normalizeScaleReadinessChecklist(raw);
    if (clean) out.push(clean);
  }
  return out;
}

export function recordScaleReadinessChecklist(list, checklist) {
  const clean = normalizeScaleReadinessChecklist(checklist);
  if (!clean) return list;
  const known = normalizeScaleReadinessChecklistList(list);
  if (known.some((item) => item.id === clean.id)) return list;
  return [...known, clean];
}

export function scaleReadinessChecklistGaps(checklist) {
  const clean = normalizeScaleReadinessChecklist(checklist);
  if (!clean) return [];
  return clean.items.filter((item) => item.status === 'gap');
}

export function scaleReadinessChecklistIsReady(checklist) {
  const clean = normalizeScaleReadinessChecklist(checklist);
  if (!clean) return false;
  return clean.items.every((item) => item.status === 'ready');
}

export function scaleReadinessChecklistStatusText(checklist) {
  const clean = normalizeScaleReadinessChecklist(checklist);
  if (!clean) return '';
  const gaps = scaleReadinessChecklistGaps(clean);
  if (gaps.length === 0) return 'Ready';
  const names = gaps.map((item) => item.label).join(', ');
  return `Not ready — ${gaps.length} gap${gaps.length === 1 ? '' : 's'}: ${names}`;
}

function scaleReadinessChecklistCompare(a, b) {
  if (a.reviewDate !== b.reviewDate) return a.reviewDate < b.reviewDate ? 1 : -1;
  if (a.id !== b.id) return a.id < b.id ? -1 : 1;
  return 0;
}

export function scaleReadinessChecklistsReady(list) {
  const known = normalizeScaleReadinessChecklistList(list);
  return known.filter(scaleReadinessChecklistIsReady).sort(scaleReadinessChecklistCompare);
}

export function scaleReadinessChecklistsNotReady(list) {
  const known = normalizeScaleReadinessChecklistList(list);
  return known.filter((item) => !scaleReadinessChecklistIsReady(item)).sort(scaleReadinessChecklistCompare);
}

export function scaleReadinessChecklistCountsAll(list) {
  const known = normalizeScaleReadinessChecklistList(list);
  const ready = known.filter(scaleReadinessChecklistIsReady).length;
  return { total: known.length, ready, notReady: known.length - ready };
}

export function scaleReadinessChecklistSummaryText(list) {
  const counts = scaleReadinessChecklistCountsAll(list);
  if (counts.total === 0) return 'No scale readiness checklists recorded.';
  return `${counts.total} readiness checklist${counts.total === 1 ? '' : 's'} recorded, ${counts.ready} ready, ${counts.notReady} not ready.`;
}

export function scaleReadinessChecklistText(checklist) {
  const clean = normalizeScaleReadinessChecklist(checklist);
  if (!clean) return '';
  const status = scaleReadinessChecklistStatusText(clean);
  const gaps = scaleReadinessChecklistGaps(clean);
  const gapNotes = gaps.map((item) => `${item.label} (${item.note})`).join('; ');
  const tail = gaps.length ? ` Gaps: ${gapNotes}.` : '';
  return `${clean.reviewDate} — Review by ${clean.reviewer}: ${status}.${tail}`;
}

function escapeScaleReadinessChecklistHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function scaleReadinessChecklistsHtml(list) {
  const known = normalizeScaleReadinessChecklistList(list);
  const sorted = [...known].sort(scaleReadinessChecklistCompare);
  const items = sorted.map((item) => `<li>${escapeScaleReadinessChecklistHtml(scaleReadinessChecklistText(item))}</li>`).join('');
  return `<ul>${items}</ul>`;
}

export function scaleReadinessChecklistGapsHtml(list) {
  const notReady = scaleReadinessChecklistsNotReady(list);
  const items = notReady.map((checklist) => {
    const gaps = scaleReadinessChecklistGaps(checklist);
    const gapText = gaps.map((item) => `${item.label}: ${item.note}`).join('; ');
    return `<li>${escapeScaleReadinessChecklistHtml(`${checklist.reviewDate} — ${checklist.reviewer}: ${gapText}`)}</li>`;
  }).join('');
  return `<ul>${items}</ul>`;
}

function scaleReadinessChecklistCsvCell(value) {
  const text = String(value ?? '');
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function scaleReadinessChecklistCsv(list) {
  const known = normalizeScaleReadinessChecklistList(list);
  const sorted = [...known].sort(scaleReadinessChecklistCompare);
  const header = ['id', 'reviewDate', 'reviewer', 'portsFree', 'stockLevels', 'collectorCapacity', 'routeCoverage', 'backupHealth', 'overall'];
  const lines = [header.map(scaleReadinessChecklistCsvCell).join(',')];
  for (const item of sorted) {
    const cells = [item.id, item.reviewDate, item.reviewer];
    for (const area of SCALE_READINESS_CHECKLIST_AREAS) {
      const found = item.items.find((entry) => entry.area === area.key);
      cells.push(found.status === 'ready' ? 'ready' : `gap: ${found.note}`);
    }
    cells.push(scaleReadinessChecklistIsReady(item) ? 'ready' : 'not ready');
    lines.push(cells.map(scaleReadinessChecklistCsvCell).join(','));
  }
  return lines.join('\n');
}

export function scaleReadinessChecklistFilename() {
  return 'scale-readiness-checklists.csv';
}
