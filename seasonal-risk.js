// Plan 159 (Plan 101-202) — Seasonal Field Risk Note.
//
// Seasonal risks such as monsoon rain, heat, or storm damage hit
// the same weak spots every year with no note to prepare for
// them. This module is the note: one risk note per season and
// segment or mohalla with a season, a risk description, an
// affected area, and a preparedness action. A season view lists
// the risks for that season with their preparedness actions, so
// known seasonal weak spots get prepared for before the season,
// not repaired after it.
//
// What this module is NOT, stated plainly:
//   - It is not a second copy of any neighbouring module.
//     No existing module records a seasonal risk note: the
//     seasonal downgrade (seasonal-downgrade.js) is a pricing
//     rule for a seasonal keep-alive package rate, the segment
//     health diary (segment-diary.js) records a segment's
//     condition on a date, the safety note (safety-note.js)
//     records a hazard at a location, and the outage record
//     (outage-type.js) classifies an outage that already
//     happened — and none of them is read or written here.
//     A risk note names a season and an area only.
//   - It is not an action on any other record. A note never
//     changes any outage, fault, bill, or payment record
//     anywhere else; it only lists risks and preparedness
//     actions for the operator to act on.
//   - It is not proof that a risk will strike. The record
//     says what the operator recorded; the module verifies
//     format and ordering, not truth.
//
// How the module keeps those fences:
//   - It is pure and import-free: the caller supplies every
//     record, and the module never reads storage, the clock,
//     or the network, never imports another module, and never
//     mutates an input. Every function returns a new list or
//     new rows.
//   - Half-formed records are refused outright, never stored
//     half-formed: a record needs an id, a season, a risk
//     description, and an affected area. A note with no
//     season or no area is refused outright, as is a note
//     with no risk description. Unknown fields are dropped,
//     so a record can never grow a field from any other
//     record type. The preparedness action is optional text.
//   - A duplicate id is never rewritten: an identical re-save
//     leaves the list unchanged, and a re-save with different
//     figures is refused outright. There is no edit function;
//     the only later change is removal of the record itself.
//   - Seasons match case-insensitively, so "Monsoon" and
//     "monsoon" are the same season view; the stored season
//     keeps the spelling first recorded for it.

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function compareText(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Normalize one seasonal risk note, or null when half-formed. */
export function normalizeSeasonalRisk(record) {
  if (!record || typeof record !== 'object') return null;
  const id = cleanText(record.id);
  const season = cleanText(record.season);
  const risk = cleanText(record.risk);
  const area = cleanText(record.area);
  if (!id || !season || !risk || !area) return null;
  return { id, season, risk, area, action: cleanText(record.action) };
}

/** Normalize a list: half-formed records dropped, order kept. */
export function normalizeSeasonalRiskList(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const record of list) {
    const clean = normalizeSeasonalRisk(record);
    if (clean) out.push(clean);
  }
  return out;
}

/** Find one seasonal risk note by id, or null. */
export function findSeasonalRisk(list, id) {
  const clean = normalizeSeasonalRiskList(list);
  const want = cleanText(id);
  return clean.find((item) => item.id === want) || null;
}

/**
 * Add a seasonal risk note, or leave the list unchanged when the
 * record is half-formed or a duplicate id carrying different
 * figures. An identical re-save leaves the list unchanged.
 */
export function upsertSeasonalRisk(list, record) {
  const clean = normalizeSeasonalRiskList(list);
  const next = normalizeSeasonalRisk(record);
  if (!next) return clean;
  const existing = clean.find((item) => item.id === next.id);
  if (existing) {
    const same = existing.season === next.season
      && existing.risk === next.risk
      && existing.area === next.area
      && existing.action === next.action;
    return same ? clean : clean;
  }
  return [...clean, next];
}

/** Remove a seasonal risk note by id; unknown ids leave the list unchanged. */
export function removeSeasonalRisk(list, id) {
  const clean = normalizeSeasonalRiskList(list);
  const want = cleanText(id);
  return clean.filter((item) => item.id !== want);
}

/** Risks for one season (case-insensitive), area A-Z, then id A-Z. */
export function seasonRisks(list, season) {
  const want = cleanText(season).toLowerCase();
  if (!want) return [];
  const clean = normalizeSeasonalRiskList(list)
    .filter((item) => item.season.toLowerCase() === want);
  clean.sort((a, b) => compareText(a.area, b.area) || compareText(a.id, b.id));
  return clean;
}

/** Every season present, A-Z by lowercase spelling, first spelling kept. */
export function seasonalRiskSeasons(list) {
  const clean = normalizeSeasonalRiskList(list);
  const byLower = new Map();
  for (const item of clean) {
    const key = item.season.toLowerCase();
    if (!byLower.has(key)) byLower.set(key, item.season);
  }
  return [...byLower.values()].sort((a, b) => compareText(a.toLowerCase(), b.toLowerCase()));
}

/** Summary text: notes / seasons / areas counts. */
export function seasonalRiskSummaryText(list) {
  const clean = normalizeSeasonalRiskList(list);
  const seasons = seasonalRiskSeasons(list).length;
  const areas = new Set(clean.map((item) => item.area.toLowerCase())).size;
  return `${clean.length} seasonal risk note${clean.length === 1 ? '' : 's'} across ${seasons} season${seasons === 1 ? '' : 's'} and ${areas} area${areas === 1 ? '' : 's'}.`;
}

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function seasonalRiskRowHtml(item) {
  return `<tr><td>${esc(item.id)}</td><td>${esc(item.season)}</td>`
    + `<td>${esc(item.risk)}</td><td>${esc(item.area)}</td><td>${esc(item.action || '—')}</td></tr>`;
}

function seasonalRiskTableHtml(rows, intro) {
  const body = rows.map((item) => seasonalRiskRowHtml(item)).join('');
  return `<p>${intro}</p>`
    + '<table><thead><tr><th>Id</th><th>Season</th>'
    + '<th>Risk</th><th>Area</th><th>Preparedness action</th></tr></thead><tbody>'
    + body + '</tbody></table>';
}

/** All seasonal risk notes as HTML, season A-Z, then area A-Z. */
export function seasonalRiskAllHtml(list) {
  const clean = normalizeSeasonalRiskList(list);
  if (clean.length === 0) return '<p>No seasonal risk notes recorded yet.</p>';
  clean.sort((a, b) => compareText(a.season.toLowerCase(), b.season.toLowerCase())
    || compareText(a.area, b.area) || compareText(a.id, b.id));
  return seasonalRiskTableHtml(clean, 'All seasonal risk notes, season by season.');
}

/** One season as HTML: its risks with their preparedness actions. */
export function seasonalRiskSeasonHtml(list, season) {
  const records = seasonRisks(list, season);
  if (records.length === 0) return '<p>No risks recorded for this season yet.</p>';
  return seasonalRiskTableHtml(records, `Risks for ${esc(season)}, with preparedness actions. Prepare before the season, not after it.`);
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** All seasonal risk notes as CSV text. */
export function seasonalRiskCsv(list) {
  const rows = normalizeSeasonalRiskList(list);
  const lines = ['id,season,risk,area,action'];
  for (const item of rows) {
    lines.push([item.id, item.season, item.risk, item.area, item.action].map(csvCell).join(','));
  }
  return lines.join('\n');
}

/** CSV filename for the seasonal risk export. */
export function seasonalRiskFilename() {
  return 'seasonal-risks.csv';
}
