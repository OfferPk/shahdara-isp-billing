// Plan 139 (Plan 101-202) — Route completion proof.
//
// A route is marked done but nobody can show which stops were
// actually visited and which were skipped. This module is the
// proof: one completion proof per route day with a route name, a
// date, the planned stops, the visited stops, the skipped stops
// with a reason each, and the collector name.
//
// What this module is NOT, stated plainly:
//   - It is not a second copy of any visit record. No existing
//     route-completion module was found to check against: the
//     route sequencing (route-sequencing.js, Plan 1) only orders
//     stops for a day's walk, the field day sheet
//     (field-day-sheet.js) only prints the day's lists, and the
//     visit outcomes (visit-outcomes.js) hold what happened on
//     each visit — and none of them is read or written here.
//     A proof names stops by label only; it never changes any
//     visit outcome, any ticket, any bill, or any payment.
//   - It is not proof of a visit. The labels say what the
//     collector reported; the module verifies format and
//     arithmetic, not truth.
//
// How the module keeps those fences:
//   - It is pure and import-free: the caller supplies every
//     record, and the module never reads storage, the clock, or
//     the network, never imports another module, and never
//     mutates an input. Every function returns a new list or
//     new rows.
//   - Half-formed proofs are refused outright, never stored
//     half-formed: a proof needs an id, a route name, a real
//     calendar date, and at least one planned stop. Every
//     planned stop must be accounted for exactly once — visited
//     or skipped, never both, never neither — so the visited
//     and skipped counts always sum to the planned stops.
//     A visited or skipped stop that was never planned is
//     refused, and a skipped stop with no reason is refused.
//     Unknown fields are dropped, so a proof can never grow a
//     visit-outcome, bill, or payment field.
//   - One proof per route day: a second proof for the same
//     route on the same date (even under a new id) is refused;
//     the first proof stands until it is removed and a fresh
//     one is recorded. A duplicate id is never rewritten:
//     an identical re-save leaves the list unchanged, and a
//     re-save with different figures is refused outright.
//     There is no edit function; the only later change is
//     removal.

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/** Strict real calendar date (YYYY-MM-DD); impossible dates refused. */
export function validRouteProofDate(value) {
  if (typeof value !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12) return null;
  let maxDay = DAYS_IN_MONTH[month - 1];
  if (month === 2 && ((year % 4 === 0 && year % 100 !== 0) || year % 400 === 0)) maxDay = 29;
  if (day < 1 || day > maxDay) return null;
  return value;
}

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function compareText(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Split a textarea-style value (one stop per line) into trimmed labels. */
export function splitStopLines(value) {
  if (Array.isArray(value)) return value.map(cleanText).filter(Boolean);
  if (typeof value !== 'string') return [];
  return value.split('\n').map(cleanText).filter(Boolean);
}

/** Dedupe stop labels case-insensitively, keeping the first spelling. */
function dedupeStops(stops) {
  const seen = new Set();
  const out = [];
  for (const stop of stops) {
    const key = stop.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(stop);
  }
  return out;
}

/**
 * Normalise one skipped stop: either { stop, reason } or the
 * string "stop | reason". Returns null when the pair is unusable.
 */
export function normalizeSkippedStop(value) {
  if (typeof value === 'string') {
    const parts = value.split('|');
    if (parts.length < 2) return null;
    const stop = cleanText(parts[0]);
    const reason = cleanText(parts.slice(1).join('|'));
    if (!stop || !reason) return null;
    return { stop, reason };
  }
  if (value && typeof value === 'object') {
    const stop = cleanText(value.stop);
    const reason = cleanText(value.reason);
    if (!stop || !reason) return null;
    return { stop, reason };
  }
  return null;
}

/**
 * Normalise one proof, or null when it is half-formed or its
 * counts do not account for every planned stop exactly once.
 */
export function normalizeRouteProof(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = cleanText(raw.id);
  const route = cleanText(raw.route);
  const date = validRouteProofDate(raw.date);
  const collector = cleanText(raw.collector);
  if (!id || !route || !date) return null;
  const planned = dedupeStops(splitStopLines(raw.planned));
  if (planned.length === 0) return null;
  const plannedKeys = new Set(planned.map((stop) => stop.toLowerCase()));
  const visitedRaw = splitStopLines(raw.visited);
  const visited = dedupeStops(visitedRaw);
  const skippedRaw = Array.isArray(raw.skipped) ? raw.skipped : splitStopLines(raw.skipped);
  const skipped = [];
  for (const entry of skippedRaw) {
    const pair = normalizeSkippedStop(entry);
    if (!pair) return null;
    skipped.push(pair);
  }
  const visitedKeys = new Set();
  for (const stop of visited) {
    const key = stop.toLowerCase();
    if (!plannedKeys.has(key) || visitedKeys.has(key)) return null;
    visitedKeys.add(key);
  }
  const skippedKeys = new Set();
  for (const pair of skipped) {
    const key = pair.stop.toLowerCase();
    if (!plannedKeys.has(key) || skippedKeys.has(key) || visitedKeys.has(key)) return null;
    skippedKeys.add(key);
  }
  // Partition invariant: every planned stop visited or skipped, never neither.
  for (const key of plannedKeys) {
    if (!visitedKeys.has(key) && !skippedKeys.has(key)) return null;
  }
  return { id, route, date, collector, planned, visited, skipped };
}

/** Normalise a list, dropping half-formed proofs (first id wins). */
export function normalizeRouteProofList(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of list) {
    const proof = normalizeRouteProof(raw);
    if (!proof || seen.has(proof.id)) continue;
    seen.add(proof.id);
    out.push(proof);
  }
  return out;
}

/** Find one proof by id, or null. */
export function findRouteProof(list, id) {
  const key = cleanText(id);
  if (!key) return null;
  return normalizeRouteProofList(list).find((proof) => proof.id === key) ?? null;
}

/**
 * Add a proof. An identical re-save leaves the list unchanged;
 * a different proof under an existing id, or a second proof for
 * the same route day, is refused and the list is returned
 * unchanged. An invalid proof is refused the same way.
 */
export function upsertRouteProof(list, raw) {
  const base = normalizeRouteProofList(list);
  const proof = normalizeRouteProof(raw);
  if (!proof) return base;
  const sameId = base.find((item) => item.id === proof.id);
  if (sameId) {
    return JSON.stringify(sameId) === JSON.stringify(proof) ? base : base;
  }
  const sameDay = base.find(
    (item) => item.route.toLowerCase() === proof.route.toLowerCase() && item.date === proof.date,
  );
  if (sameDay) return base;
  return [...base, proof];
}

/** Remove one proof by id. */
export function removeRouteProof(list, id) {
  const key = cleanText(id);
  if (!key) return normalizeRouteProofList(list);
  return normalizeRouteProofList(list).filter((proof) => proof.id !== key);
}

/** One route day's proof, or null when none was recorded. */
export function routeProofForDay(list, route, date) {
  const routeKey = cleanText(route).toLowerCase();
  const day = validRouteProofDate(date);
  if (!routeKey || !day) return null;
  return (
    normalizeRouteProofList(list).find(
      (proof) => proof.route.toLowerCase() === routeKey && proof.date === day,
    ) ?? null
  );
}

/** Visited / skipped / planned counts for one proof. */
export function routeProofCounts(proof) {
  const clean = normalizeRouteProof(proof);
  if (!clean) return { planned: 0, visited: 0, skipped: 0 };
  return { planned: clean.planned.length, visited: clean.visited.length, skipped: clean.skipped.length };
}

/** Proofs newest first, then route A-Z, then id. */
export function sortRouteProofsNewestFirst(list) {
  return [...normalizeRouteProofList(list)].sort(
    (a, b) => compareText(b.date, a.date) || compareText(a.route.toLowerCase(), b.route.toLowerCase()) || compareText(a.id, b.id),
  );
}

/** Skipped stops still needing a follow-up, newest day first. */
export function routeProofFollowups(list) {
  const out = [];
  for (const proof of normalizeRouteProofList(list)) {
    for (const pair of proof.skipped) {
      out.push({ route: proof.route, date: proof.date, collector: proof.collector, stop: pair.stop, reason: pair.reason, proofId: proof.id });
    }
  }
  return out.sort(
    (a, b) => compareText(b.date, a.date) || compareText(a.route.toLowerCase(), b.route.toLowerCase()) || compareText(a.stop.toLowerCase(), b.stop.toLowerCase()),
  );
}

/** One-line summary of the whole log. */
export function routeProofSummaryText(list) {
  const base = normalizeRouteProofList(list);
  if (base.length === 0) return 'No route completion proof recorded yet.';
  const visited = base.reduce((sum, proof) => sum + proof.visited.length, 0);
  const skipped = base.reduce((sum, proof) => sum + proof.skipped.length, 0);
  const planned = visited + skipped;
  return `${base.length} route day${base.length === 1 ? '' : 's'} proved: ${visited} stop${visited === 1 ? '' : 's'} visited, ${skipped} skipped, of ${planned} planned. Skipped stops stay on the follow-up list. Recording a proof never changes any visit outcome or payment.`;
}

/** A route day's page: counts that sum to planned, plus both lists. */
export function routeProofDayHtml(list, route, date) {
  const routeKey = cleanText(route);
  const day = validRouteProofDate(date);
  if (!routeKey || !day) return '<p>Pick a route and a date to see that route day\u2019s proof.</p>';
  const proof = routeProofForDay(list, routeKey, day);
  if (!proof) return `<p>No route completion proof recorded yet for ${escapeHtml(routeKey)} on ${escapeHtml(day)}.</p>`;
  const counts = routeProofCounts(proof);
  const visitedRows = proof.visited.map((stop) => `<li>${escapeHtml(stop)}</li>`).join('');
  const skippedRows = proof.skipped
    .map((pair) => `<li>${escapeHtml(pair.stop)} — ${escapeHtml(pair.reason)}</li>`)
    .join('');
  return `<p>Route ${escapeHtml(proof.route)} on ${escapeHtml(proof.date)}${proof.collector ? `, collector ${escapeHtml(proof.collector)}` : ''}: ${counts.visited} visited + ${counts.skipped} skipped = ${counts.planned} planned.</p><h5>Visited</h5><ul>${visitedRows}</ul><h5>Skipped</h5><ul>${skippedRows}</ul>`;
}

/** Proofs list, optionally filtered to one route (case-insensitive). */
export function routeProofHtml(list, routeFilter) {
  const key = cleanText(routeFilter).toLowerCase();
  const rows = sortRouteProofsNewestFirst(list).filter(
    (proof) => !key || proof.route.toLowerCase().includes(key),
  );
  if (rows.length === 0) return '<p>No route completion proof recorded yet.</p>';
  const body = rows
    .map((proof) => {
      const counts = routeProofCounts(proof);
      return `<tr><td>${escapeHtml(proof.id)}</td><td>${escapeHtml(proof.route)}</td><td>${escapeHtml(proof.date)}</td><td>${escapeHtml(proof.collector)}</td><td>${counts.visited} + ${counts.skipped} = ${counts.planned}</td></tr>`;
    })
    .join('');
  return `<table><thead><tr><th>Id</th><th>Route</th><th>Date</th><th>Collector</th><th>Visited + skipped = planned</th></tr></thead><tbody>${body}</tbody></table>`;
}

/** Skipped stops still needing a follow-up, as a list. */
export function routeProofFollowupHtml(list) {
  const rows = routeProofFollowups(list);
  if (rows.length === 0) return '<p>No skipped stop is waiting for a follow-up.</p>';
  const body = rows
    .map(
      (row) => `<tr><td>${escapeHtml(row.date)}</td><td>${escapeHtml(row.route)}</td><td>${escapeHtml(row.stop)}</td><td>${escapeHtml(row.reason)}</td><td>${escapeHtml(row.collector)}</td></tr>`,
    )
    .join('');
  return `<table><thead><tr><th>Date</th><th>Route</th><th>Skipped stop</th><th>Reason</th><th>Collector</th></tr></thead><tbody>${body}</tbody></table>`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function csvCell(value) {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** CSV for a list of proofs (one row per proof; stops joined by "; "). */
export function routeProofCsv(list) {
  const base = sortRouteProofsNewestFirst(list);
  const header = 'id,route,date,collector,planned,visited,skipped';
  const rows = base.map((proof) =>
    [
      proof.id,
      proof.route,
      proof.date,
      proof.collector,
      proof.planned.join('; '),
      proof.visited.join('; '),
      proof.skipped.map((pair) => `${pair.stop} | ${pair.reason}`).join('; '),
    ]
      .map(csvCell)
      .join(','),
  );
  return [header, ...rows].join('\n');
}

/** CSV filename for the log. */
export function routeProofFilename() {
  return 'route-proofs.csv';
}
