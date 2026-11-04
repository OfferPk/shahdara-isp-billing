// Plan 146 (Plan 101-202) — Pole/cabinet inspection round.
//
// Poles and cabinets are only looked at after something breaks, so
// loose, damaged, or water-affected hardware is missed. This module
// is the regular walk-round: one inspection round per area per
// date, listing every pole and cabinet checked, the condition of
// each item (good / watch / poor), and an action note. Watch and
// poor items stay on an action list until they are recorded as
// fixed, so a weak pole or a damp cabinet gets attention before
// weather or wear turns it into an outage.
//
// What this module is NOT, stated plainly:
//   - It is not a maintenance calendar. Plan 48's maintenance
//     calendar is neither read nor written here: a round never
//     creates, moves, or closes a maintenance window, and it
//     never changes any bill or payment.
//   - It is not an asset register. The pole-asset tracker and the
//     pole-landmark book are neither read nor written here: a
//     round names items by label only and changes no asset.
//   - It is not a fault ticket, a QA inspection, or a storm
//     report. The fault log, the QA inspection modules, and the
//     storm-inspection module are neither read nor written
//     here: a round only records what the walk-round observed.
//
// How the module keeps those fences:
//   - It is pure and import-free: the caller supplies every
//     record, and the module never reads storage, the clock, or
//     the network, never imports another module, and never
//     mutates an input. Every function returns a new list or
//     new rows.
//   - Half-formed rounds are refused outright, never stored
//     half-formed: a round needs an id, an area, and a real
//     calendar date. A round with no date is refused, and so
//     is a round with no area or an impossible date. Unknown
//     fields are dropped, so a round can never grow a
//     maintenance, bill, or payment field.
//   - One round per area per date: an area cannot gain a
//     second round for the same date under a different id
//     (area match is case-insensitive). A duplicate id is
//     never rewritten: an identical re-save leaves the list
//     unchanged, and a re-save with different figures is
//     refused outright. There is no edit function; the only
//     later changes are recording an item as fixed and removal.
//   - Conditions are only good, watch, or poor. An unknown
//     condition is recorded as watch, never silently good, so
//     an unclear item stays visible. An unknown item kind is
//     recorded as other.
//   - Dates are real YYYY-MM-DD calendar dates (2026-02-30 is
//     rejected, never guessed; 2026-08-31, 2026-10-31 and
//     2026-12-31 are real and pass).

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Strict calendar date: YYYY-MM-DD that really exists, or null. */
export function validPoleInspectionDate(value) {
  if (typeof value !== 'string') return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1) return null;
  const days = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (day > days[month - 1]) return null;
  return value;
}

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function cleanPoleInspectionCondition(value) {
  const v = cleanText(value).toLowerCase();
  return v === 'good' || v === 'poor' ? v : 'watch';
}

export function cleanPoleInspectionKind(value) {
  const v = cleanText(value).toLowerCase();
  return v === 'pole' || v === 'cabinet' ? v : 'other';
}

function normalizePoleInspectionItem(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const name = cleanText(raw.name);
  if (!name) return null;
  const fixedDate = validPoleInspectionDate(raw.fixedDate);
  return {
    name,
    kind: cleanPoleInspectionKind(raw.kind),
    condition: cleanPoleInspectionCondition(raw.condition),
    note: cleanText(raw.note),
    fixed: raw.fixed === true,
    fixedDate: raw.fixed === true ? (fixedDate || null) : null,
  };
}

/** Parse one item per line: "name | pole|cabinet | good|watch|poor | note". */
export function parsePoleInspectionItems(text) {
  if (typeof text !== 'string') return [];
  const items = [];
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const parts = trimmed.split('|').map(part => part.trim());
    const item = normalizePoleInspectionItem({
      name: parts[0] || '',
      kind: parts[1] || '',
      condition: parts[2] || '',
      note: parts.slice(3).join(' | '),
    });
    if (item) items.push(item);
  }
  return items;
}

export function normalizePoleInspectionRound(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = cleanText(raw.id);
  const area = cleanText(raw.area);
  const date = validPoleInspectionDate(raw.date);
  if (!id || !area || !date) return null;
  const items = Array.isArray(raw.items)
    ? raw.items.map(normalizePoleInspectionItem).filter(Boolean)
    : [];
  const seen = new Set();
  const unique = [];
  for (const item of items) {
    const key = item.name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(item);
  }
  return {
    id,
    area,
    date,
    inspector: cleanText(raw.inspector),
    items: unique,
  };
}

export function normalizePoleInspectionList(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const raw of list) {
    const round = normalizePoleInspectionRound(raw);
    if (round) out.push(round);
  }
  return out;
}

function sameRound(a, b) {
  return a.id === b.id
    && a.area === b.area
    && a.date === b.date
    && a.inspector === b.inspector
    && JSON.stringify(a.items) === JSON.stringify(b.items);
}

export function findPoleInspectionRound(list, id) {
  const clean = normalizePoleInspectionList(list);
  return clean.find(round => round.id === id) || null;
}

export function upsertPoleInspectionRound(list, raw) {
  const clean = normalizePoleInspectionList(list);
  const round = normalizePoleInspectionRound(raw);
  if (!round) return clean;
  const byId = clean.findIndex(item => item.id === round.id);
  if (byId >= 0) {
    if (sameRound(clean[byId], round)) return clean;
    return clean;
  }
  const sameAreaDate = clean.some(item =>
    item.area.toLowerCase() === round.area.toLowerCase() && item.date === round.date);
  if (sameAreaDate) return clean;
  return [...clean, round];
}

export function removePoleInspectionRound(list, id) {
  const clean = normalizePoleInspectionList(list);
  return clean.filter(round => round.id !== id);
}

/** Record one checked item as fixed; it leaves the action list. */
export function markPoleInspectionItemFixed(list, roundId, itemName, fixedDate) {
  const clean = normalizePoleInspectionList(list);
  const name = cleanText(itemName);
  if (!name) return clean;
  return clean.map(round => {
    if (round.id !== roundId) return round;
    const date = validPoleInspectionDate(fixedDate) || round.date;
    return {
      ...round,
      items: round.items.map(item =>
        item.name.toLowerCase() === name.toLowerCase()
          ? { ...item, fixed: true, fixedDate: date }
          : item),
    };
  });
}

export function poleInspectionConditionCounts(round) {
  const counts = { good: 0, watch: 0, poor: 0 };
  if (!round || !Array.isArray(round.items)) return counts;
  for (const item of round.items) {
    if (counts[item.condition] !== undefined) counts[item.condition] += 1;
  }
  return counts;
}

/** Rounds newest first, then area A-Z, then id A-Z. */
export function poleInspectionRoundsSorted(list) {
  const clean = normalizePoleInspectionList(list);
  return [...clean].sort((a, b) =>
    b.date.localeCompare(a.date)
    || a.area.toLowerCase().localeCompare(b.area.toLowerCase())
    || a.id.localeCompare(b.id));
}

/** Watch/poor items not yet fixed: newest round first, then item A-Z. */
export function poleInspectionActionList(list) {
  const out = [];
  for (const round of poleInspectionRoundsSorted(list)) {
    const pending = round.items
      .filter(item => !item.fixed && (item.condition === 'watch' || item.condition === 'poor'))
      .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
    for (const item of pending) {
      out.push({
        roundId: round.id,
        area: round.area,
        date: round.date,
        name: item.name,
        kind: item.kind,
        condition: item.condition,
        note: item.note,
      });
    }
  }
  return out;
}

export function poleInspectionSummaryText(list) {
  const clean = normalizePoleInspectionList(list);
  const areas = new Set(clean.map(round => round.area.toLowerCase())).size;
  const action = poleInspectionActionList(clean).length;
  const items = clean.reduce((sum, round) => sum + round.items.length, 0);
  return `${clean.length} rounds · ${areas} areas · ${items} items checked · ${action} actions open`;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

export function poleInspectionRoundsHtml(list, areaFilter) {
  const filter = cleanText(areaFilter).toLowerCase();
  const rounds = poleInspectionRoundsSorted(list)
    .filter(round => !filter || round.area.toLowerCase().includes(filter));
  if (!rounds.length) return '<p>No inspection rounds recorded yet.</p>';
  const rows = rounds.map(round => {
    const counts = poleInspectionConditionCounts(round);
    const items = round.items.length
      ? round.items.map(item =>
        `<li>${escapeHtml(item.name)} (${escapeHtml(item.kind)}, ${escapeHtml(item.condition)}${item.fixed ? ', fixed' : ''}${item.note ? ` — ${escapeHtml(item.note)}` : ''})</li>`).join('')
      : '<li>No items listed.</li>';
    return `<div><strong>${escapeHtml(round.area)}</strong> · ${escapeHtml(round.date)}${round.inspector ? ` · ${escapeHtml(round.inspector)}` : ''} · good ${counts.good} · watch ${counts.watch} · poor ${counts.poor}<ul>${items}</ul></div>`;
  });
  return rows.join('');
}

export function poleInspectionActionHtml(list) {
  const actions = poleInspectionActionList(list);
  if (!actions.length) return '<p>No open actions — every watch/poor item is fixed.</p>';
  const rows = actions.map(item =>
    `<li>${escapeHtml(item.area)} · ${escapeHtml(item.date)} · ${escapeHtml(item.name)} (${escapeHtml(item.kind)}, ${escapeHtml(item.condition)})${item.note ? ` — ${escapeHtml(item.note)}` : ''}</li>`).join('');
  return `<ul>${rows}</ul>`;
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function poleInspectionCsv(list) {
  const clean = normalizePoleInspectionList(list);
  const lines = ['round_id,area,date,inspector,item,kind,condition,note,fixed,fixed_date'];
  for (const round of clean) {
    for (const item of round.items) {
      lines.push([round.id, round.area, round.date, round.inspector, item.name, item.kind, item.condition, item.note, item.fixed ? 'yes' : 'no', item.fixedDate || ''].map(csvCell).join(','));
    }
  }
  return lines.join('\n');
}

export function poleInspectionFilename() {
  return 'pole-inspections.csv';
}
