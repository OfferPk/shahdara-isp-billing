// Plan 92 (Plan 1-100) — Mohalla service-status board: one honest
// status per mohalla, read from the records that already exist.
//
// During an outage or planned work, customers in different mohallas
// hear different stories, because there is no single, current status
// view the operator can read from or quote. This module is that
// board — and nothing else:
//
//   - It is read-only and import-free: the caller supplies every
//     mohalla, every outage record, and every maintenance window,
//     and the module never reads storage, the clock, or the network,
//     and never mutates an input. It sets no status by itself and
//     changes no ticket, billing, or customer record. Clearing a
//     source record clears the board entry on the next build,
//     because the board holds no copy of anything.
//   - One status per mohalla, from its linked records only:
//       outage      — an OPEN outage covers the mohalla.
//       degraded    — an IN PROGRESS outage covers the mohalla:
//                     the fault is being worked on, so the board
//                     shows degraded service while work proceeds,
//                     rather than claiming the mohalla is fully down
//                     or fully fine. This is a display mapping of
//                     the outage's own status, not a measurement.
//       maintenance — an active planned window covers the mohalla:
//                     a window in progress, or a scheduled window
//                     dated today. A scheduled window for another
//                     day, a completed window, and a postponed
//                     window never mark a mohalla today.
//       normal      — no open outage and no active window covers
//                     the mohalla. Never guessed: a mohalla with no
//                     linked record is normal, full stop.
//   - Precedence when several records cover one mohalla, worst
//     first: outage, then degraded, then maintenance, then normal.
//     The winning link is named on the row, and every other linked
//     record is still listed in the row's sources, so a window
//     hidden behind an outage is never silently dropped.
//   - Mohalla matching mirrors the Plan T canonical rule, as the
//     maintenance calendar does: a leading generic "Mohalla" word
//     is stripped, comparison is case-insensitive, and known
//     spellings collapse (bani -> BANII, kishti -> KISHTII,
//     chamyaa -> CHAMYAAA). A mohalla named only by an outage or a
//     window still gets a row — the board is the union of the
//     supplied mohallas and every mohalla a live record names.
//   - An area typed in an outage record is shown under exactly
//     that name: the board quotes the record, it never invents a
//     mohalla from it and never silently drops it. A segment
//     mapping ({ segment, mohallas }) lets the caller say which
//     mohallas a splitter segment covers; an area that exactly
//     names a mapped segment is read as that segment, and covers
//     the segment's mohallas instead of appearing as a row of its
//     own. If the operator typed a segment name as the area and
//     no mapping was supplied, the row carries that name until
//     the record is corrected at its source — visibly, not hidden.
//   - A window with an impossible date, an unknown status, or no
//     mohalla and no segment is dropped, never counted on a
//     guessed figure. When no usable today is supplied, scheduled
//     windows never count as active — the board never invents a
//     date to make them active.

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

const MOHALLA_ALIASES = Object.freeze({
  bani: 'BANII',
  kishti: 'KISHTII',
  chamyaa: 'CHAMYAAA',
  // Owner-confirmed 2026-11-11: JABBIYAAA is the same mohalla as
  // JABBIYAA, and the two "Orient School" spellings are one place.
  // Charyaa is NOT an alias — it is its own mohalla and never folds
  // to CHAMYAAA. Distinct register entries (Barrian Owner, Dc House
  // End Point, Khattak Swimming Pool, …) are not aliases and stay
  // separate rows; only spelling variants of the same mohalla fold.
  jabbiyaaa: 'JABBIYAA',
  'orien school': 'Orient School',
  'orient scholl': 'Orient School',
});

export const BOARD_STATUSES = Object.freeze(['normal', 'degraded', 'outage', 'maintenance']);

export const BOARD_STATUS_LABELS = Object.freeze({
  normal: 'Normal',
  degraded: 'Degraded',
  outage: 'Outage',
  maintenance: 'Planned maintenance',
});

const STATUS_RANK = Object.freeze({ outage: 0, degraded: 1, maintenance: 2, normal: 3 });

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch]));
}

function csvCell(value) {
  const str = String(value ?? '');
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

function normalizedText(value) {
  return String(value ?? '').normalize('NFKC').replace(/\s+/gu, ' ').trim();
}

function stripMohallaPrefix(value) {
  const stripped = normalizedText(value).replace(/^(?:mohalla|mohalaa)\s+/iu, '');
  return stripped || normalizedText(value);
}

function readableLabel(value) {
  return normalizedText(value).split(' ').map((word) => {
    const chars = Array.from(word);
    if (!chars.length) return word;
    return chars[0].toLocaleUpperCase('en-US') + chars.slice(1).join('').toLocaleLowerCase('en-US');
  }).join(' ');
}

// Mirrors the Plan T canonical rule without importing it. Returns
// { key, label, stored } or null when blank.
export function canonicalBoardMohalla(value) {
  const raw = normalizedText(value);
  if (!raw) return null;
  const stripped = stripMohallaPrefix(raw);
  const key = stripped.toLowerCase();
  const canonical = MOHALLA_ALIASES[key];
  if (canonical) return { key: canonical.toLowerCase(), label: readableLabel(canonical), stored: canonical };
  return { key, label: readableLabel(stripped), stored: stripped };
}

export function isValidBoardDate(value) {
  const match = DATE_PATTERN.exec(text(value));
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const built = new Date(Date.UTC(year, month - 1, day));
  return built.getUTCFullYear() === year && built.getUTCMonth() === month - 1 && built.getUTCDate() === day;
}

const OUTAGE_STATUS_SET = new Set(['open', 'in_progress', 'resolved']);
const WINDOW_STATUS_SET = new Set(['scheduled', 'in_progress', 'completed', 'postponed']);

// One normalised outage, or null when it cannot cover a mohalla: no
// area. An unknown status falls back to open, mirroring the outage
// module's display default; a missing start time or cause note is
// shown as "Not recorded", never guessed.
export function normalizeBoardOutage(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const area = text(entry.area);
  if (!area) return null;
  const status = OUTAGE_STATUS_SET.has(text(entry.status)) ? text(entry.status) : 'open';
  return {
    id: text(entry.id),
    area,
    segment: text(entry.segment),
    status,
    startTime: text(entry.startTime),
    causeNote: text(entry.causeNote),
  };
}

export function normalizeBoardOutages(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const entry of list) {
    const outage = normalizeBoardOutage(entry);
    if (outage) out.push(outage);
  }
  return out;
}

// One normalised window, or null when it cannot cover a mohalla:
// an impossible date, an unknown status, or no mohalla and no
// segment. Times are not needed for the board, so a window without
// times still counts when its date and status make it active.
export function normalizeBoardWindow(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const id = text(entry.id);
  const date = text(entry.date);
  const status = text(entry.status);
  if (!isValidBoardDate(date) || !WINDOW_STATUS_SET.has(status)) return null;
  const mohallas = [];
  const seen = new Set();
  for (const raw of Array.isArray(entry.mohallas) ? entry.mohallas : (Array.isArray(entry.areas) ? entry.areas : [])) {
    const canon = canonicalBoardMohalla(raw);
    if (canon && !seen.has(canon.key)) {
      seen.add(canon.key);
      mohallas.push(canon.stored);
    }
  }
  const segments = [];
  for (const raw of Array.isArray(entry.segments) ? entry.segments : (Array.isArray(entry.splitters) ? entry.splitters : [])) {
    const clean = text(raw);
    if (clean) segments.push(clean);
  }
  if (mohallas.length === 0 && segments.length === 0) return null;
  return { id, date, status, description: text(entry.description ?? entry.work), mohallas, segments };
}

export function normalizeBoardWindows(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const entry of list) {
    const window = normalizeBoardWindow(entry);
    if (window) out.push(window);
  }
  return out;
}

function segmentMap(segmentsInput) {
  const map = new Map();
  for (const entry of Array.isArray(segmentsInput) ? segmentsInput : []) {
    if (!entry || typeof entry !== 'object') continue;
    const segmentKey = text(entry.segment).toLowerCase();
    if (!segmentKey) continue;
    const covered = [];
    const seen = new Set();
    for (const raw of Array.isArray(entry.mohallas) ? entry.mohallas : []) {
      const canon = canonicalBoardMohalla(raw);
      if (canon && !seen.has(canon.key)) {
        seen.add(canon.key);
        covered.push({ key: canon.key, label: canon.label });
      }
    }
    if (covered.length) map.set(segmentKey, covered);
  }
  return map;
}

// Mohallas one outage covers, each with its display label. The
// area names a mohalla — unless it exactly names a mapped segment,
// in which case it is the segment and covers the segment's
// mohallas, not a mohalla spelled like the segment. The segment
// field, when mapped, adds its mohallas too. Returns an empty list
// when the outage covers no known mohalla — the caller reports it
// as unmapped.
function outageMohallas(outage, segmentMappings) {
  const covered = [];
  const seen = new Set();
  const add = (entry) => {
    if (!seen.has(entry.key)) {
      seen.add(entry.key);
      covered.push(entry);
    }
  };
  const areaMapped = segmentMappings.get(text(outage.area).toLowerCase());
  if (areaMapped) {
    for (const entry of areaMapped) add(entry);
  } else {
    const areaCanon = canonicalBoardMohalla(outage.area);
    if (areaCanon) add({ key: areaCanon.key, label: areaCanon.label });
  }
  const segmentMapped = segmentMappings.get(text(outage.segment).toLowerCase());
  if (segmentMapped) {
    for (const entry of segmentMapped) add(entry);
  }
  return covered;
}

function windowMohallas(window, segmentMappings) {
  const covered = [];
  const seen = new Set();
  for (const raw of window.mohallas) {
    const canon = canonicalBoardMohalla(raw);
    if (canon && !seen.has(canon.key)) {
      seen.add(canon.key);
      covered.push({ key: canon.key, label: canon.label });
    }
  }
  for (const raw of window.segments) {
    const mapped = segmentMappings.get(raw.toLowerCase());
    if (mapped) {
      for (const entry of mapped) {
        if (!seen.has(entry.key)) {
          seen.add(entry.key);
          covered.push(entry);
        }
      }
    }
  }
  return covered;
}

function windowIsActive(window, today) {
  if (window.status === 'in_progress') return true;
  if (window.status === 'scheduled') return today !== null && window.date === today;
  return false;
}

// The board: one row per mohalla, worst status first. Inputs are
// never mutated; the result is fresh on every call, so clearing a
// source record clears its board entry on the next build.
export function buildStatusBoard({ mohallas, outages, windows, today, segments } = {}) {
  const usableToday = isValidBoardDate(today) ? text(today) : null;
  const segmentMappings = segmentMap(segments);
  const rowsByKey = new Map();
  const ensureRow = (canon) => {
    if (!rowsByKey.has(canon.key)) {
      rowsByKey.set(canon.key, {
        key: canon.key,
        mohalla: canon.label,
        status: 'normal',
        sources: [],
        outageId: '',
        windowId: '',
        sourceLabel: '',
      });
    }
    return rowsByKey.get(canon.key);
  };

  for (const raw of Array.isArray(mohallas) ? mohallas : []) {
    const canon = canonicalBoardMohalla(raw);
    if (canon) ensureRow(canon);
  }

  for (const outage of normalizeBoardOutages(outages)) {
    if (outage.status === 'resolved') continue;
    const covered = outageMohallas(outage, segmentMappings);
    const boardStatus = outage.status === 'in_progress' ? 'degraded' : 'outage';
    for (const entry of covered) {
      const row = ensureRow(entry);
      row.sources.push({
        kind: 'outage',
        id: outage.id,
        status: boardStatus,
        label: outage.causeNote || 'Outage',
        detail: outage.startTime ? `Started ${outage.startTime}` : 'Start time not recorded',
      });
      if (STATUS_RANK[boardStatus] < STATUS_RANK[row.status]) {
        row.status = boardStatus;
        row.outageId = outage.id;
        row.sourceLabel = outage.causeNote || 'Outage';
      }
    }
  }

  for (const window of normalizeBoardWindows(windows)) {
    if (!windowIsActive(window, usableToday)) continue;
    for (const entry of windowMohallas(window, segmentMappings)) {
      const row = ensureRow(entry);
      row.sources.push({
        kind: 'window',
        id: window.id,
        status: 'maintenance',
        label: window.description || 'Planned work',
        detail: `${window.date}${window.status === 'in_progress' ? ' · in progress' : ' · scheduled today'}`,
      });
      if (STATUS_RANK.maintenance < STATUS_RANK[row.status]) {
        row.status = 'maintenance';
        row.windowId = window.id;
        row.sourceLabel = window.description || 'Planned work';
      }
    }
  }

  const rows = [...rowsByKey.values()].sort((a, b) => {
    if (STATUS_RANK[a.status] !== STATUS_RANK[b.status]) return STATUS_RANK[a.status] - STATUS_RANK[b.status];
    return a.mohalla < b.mohalla ? -1 : a.mohalla > b.mohalla ? 1 : 0;
  });
  return { rows, today: usableToday };
}

export function filterBoardRows(rows, { status, mohalla } = {}) {
  const statusFilter = text(status);
  const mohallaFilter = canonicalBoardMohalla(mohalla);
  return (Array.isArray(rows) ? rows : []).filter((row) => {
    if (statusFilter && row.status !== statusFilter) return false;
    if (mohallaFilter && row.key !== mohallaFilter.key) return false;
    return true;
  });
}

export function boardSummary(board) {
  const counts = { normal: 0, degraded: 0, outage: 0, maintenance: 0, total: 0 };
  for (const row of board?.rows ?? []) {
    if (counts[row.status] !== undefined) counts[row.status] += 1;
    counts.total += 1;
  }
  return counts;
}

export function boardSummaryText(board) {
  const summary = boardSummary(board);
  const parts = [`${summary.total} mohalla${summary.total === 1 ? '' : 's'} on the board`];
  if (summary.outage) parts.push(`${summary.outage} in outage`);
  if (summary.degraded) parts.push(`${summary.degraded} degraded`);
  if (summary.maintenance) parts.push(`${summary.maintenance} under planned maintenance`);
  if (summary.normal) parts.push(`${summary.normal} normal`);
  return parts.join(' · ');
}

export function boardHtml(board) {
  const rows = board?.rows ?? [];
  if (!rows.length) return '<p class="empty-state">No mohallas on the board yet.</p>';
  const body = rows.map((row) => {
    const sources = row.sources.map((source) => `${source.kind === 'outage' ? 'Outage' : 'Maintenance'}: ${escapeHtml(source.label)} (${escapeHtml(source.detail)})`).join('<br>') || 'No linked record — normal.';
    return `<tr><td><strong>${escapeHtml(row.mohalla)}</strong></td><td>${escapeHtml(BOARD_STATUS_LABELS[row.status] ?? row.status)}</td><td>${escapeHtml(row.sourceLabel || '—')}</td><td><small>${sources}</small></td></tr>`;
  }).join('');
  // Owner 5-part fix: the board table scrolls inside its own card on
  // a phone instead of clipping the linked-records column.
  return `<div class="table-scroll"><table><thead><tr><th>Mohalla</th><th>Status</th><th>Linked record</th><th>All linked records</th></tr></thead><tbody>${body}</tbody></table></div>`;
}

export function boardCsv(board) {
  const header = 'mohalla,status,linked_record,linked_sources';
  const lines = (board?.rows ?? []).map((row) => [
    csvCell(row.mohalla),
    csvCell(row.status),
    csvCell(row.sourceLabel),
    csvCell(row.sources.map((source) => `${source.kind}:${source.label}`).join('; ')),
  ].join(','));
  return [header, ...lines].join('\n');
}

export function boardFilename(today) {
  return isValidBoardDate(today) ? `status-board-${text(today)}.csv` : 'status-board.csv';
}
