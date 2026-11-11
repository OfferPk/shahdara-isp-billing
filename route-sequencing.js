// Plan 1 (Plan 1-100) — Field route sequencing by mohalla and dues priority.
//
// ORDERING ONLY. This module computes no money of its own, changes no
// billing, Waada, or handover rule, and never mutates its inputs: it
// takes the route stops another builder already computed (see
// calculateFieldCollectionRoutes in nav-collection-rounds.js) and
// returns them in one day's walking order, plus a per-mohalla summary.
//
// Why a new ordering exists when the route sheet already offers
// 'priority', 'due-high' and 'area' sorts: none of those does what
// Plan 1 asks for together —
//   * 'priority' orders by urgency score across the whole list, so a
//     collector criss-crosses mohallas;
//   * 'due-high' orders by balance across the whole list, same problem;
//   * 'area' groups by raw sector string, so "MOHALLA BANI", "Bani"
//     and "BANII" can land in different groups, and it never surfaces
//     Waada-broken customers first.
// This module does all three at once, and nothing else.
//
// The order, in full (documented here so the collector can audit it):
//   1. Group by canonical mohalla (Plan T rule, mirrored below — see
//      routeMohallaKey). A stop with no mohalla and no area lands in
//      the "Unassigned" group, never dropped.
//   2. Groups are ordered by their total pending due, largest first,
//      ties broken by mohalla label A-Z. The collector therefore works
//      the money-heaviest mohalla first while still walking one
//      mohalla at a time, instead of zig-zagging between mohallas.
//   3. Inside a group, uncollected stops come before collected ones
//      (collected = isCollected, or outcome 'paid'/'partial' — the
//      same collected definition the route builder counts with), so a
//      group stays together if the collector revisits it.
//   4. Inside a group, Waada-broken stops come first: a stop whose
//      promise date is before the route date and which is not
//      collected. A promised stop whose date is still in the future
//      is NOT broken and is not surfaced. Broken detection reads the
//      stop's own promise fields (promiseDate, promiseStatus, or an
//      explicit waadaBroken flag) — the same promise source the route
//      sheet already carries on each stop; it does not re-derive
//      promises from bills or payments.
//   5. Then largest total due first, then oldest unpaid month first
//      (earliestUnpaidMonth ascending; stops with no unpaid month
//      sort after dated ones), then customer name A-Z, then the
//      stop's original position — so the order is fully deterministic.
//
// The original list order is never lost: every returned copy carries
// its originalIndex, and restoreRouteOrder returns the copies in
// that order. Switching the route sheet's sort dropdown back to any
// other option is the other fallback — sequencing is one more sort
// option, not a replacement for the existing ones.
//
// The module is import-free by design (like nav-collection-rounds.js),
// so the route sheet can import it without pulling in the app graph.

export const ROUTE_SEQUENCE_SORT_ID = 'sequenced';

// Alias spellings that Plan T's canonicalMohalla maps onto one entry
// (phase3.js MOHALLA_ALIASES, verified against main): 'bani' is
// 'BANII', 'kishti' is 'KISHTII', 'chamyaa' is 'CHAMYAAA'. The key
// rule below mirrors that function for grouping purposes only; labels
// are the owner's standard spelling where one is known, otherwise the
// first-seen trimmed name for the group.
const MOHALLA_ALIASES = Object.freeze({
  bani: 'banii',
  kishti: 'kishtii',
  chamyaa: 'chamyaaa',
  // Owner-confirmed 2026-11-11: JABBIYAAA is the same mohalla as
  // JABBIYAA. Charyaa is NOT an alias — it is its own mohalla.
  jabbiyaaa: 'jabbiyaa',
});

const CANONICAL_MOHALLAS = Object.freeze([
  'CHARYAA', 'GANGALL', 'KISHTII', 'BARRIAN', 'THALII', 'CHAMYAAA',
  'PALALIYAA', 'MALLA', 'NAKAR', 'BANII', 'SODAA', 'PULL SIDE',
  'JABBIYAA', 'MOHALLA CHUDRIYAA', 'MOHALLA end side farm house',
]);

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function str(value) {
  return value == null ? '' : String(value);
}

function normaliseText(value) {
  return str(value).normalize('NFKC').replace(/\s+/gu, ' ').trim();
}

function stripMohallaPrefix(text) {
  const stripped = normaliseText(text).replace(/^(?:mohalla|mohalaa)\s+/iu, '');
  return stripped || normaliseText(text);
}

function comparisonKey(value) {
  return normaliseText(value).toLowerCase().normalize('NFKC');
}

/**
 * Canonical grouping key for a route stop, mirroring Plan T's
 * canonicalMohalla key: the mohalla field wins over area (same
 * precedence as customerAreaKey in area-operations.js), the leading
 * generic "Mohalla" word is not part of the identity, and alias
 * spellings collapse onto one key. Blank input gives the
 * 'unassigned' key, never null, so no stop is dropped.
 */
export function routeMohallaKey(stop = {}) {
  const raw = str(stop.mohalla || stop.area || '').trim();
  if (!raw) return 'unassigned';
  const stripped = stripMohallaPrefix(raw);
  const key = comparisonKey(stripped);
  if (MOHALLA_ALIASES[key]) return MOHALLA_ALIASES[key];
  const canonical = CANONICAL_MOHALLAS.find(
    (name) => comparisonKey(stripMohallaPrefix(name)) === key,
  );
  return canonical ? comparisonKey(stripMohallaPrefix(canonical)) : key;
}

/** Readable label for a mohalla group: the owner's standard spelling where known. */
export function routeMohallaLabel(stop = {}) {
  const raw = str(stop.mohalla || stop.area || '').trim();
  if (!raw) return 'Unassigned';
  const key = routeMohallaKey(stop);
  const canonical = CANONICAL_MOHALLAS.find(
    (name) => comparisonKey(stripMohallaPrefix(name)) === key,
  );
  if (canonical) {
    const label = stripMohallaPrefix(canonical);
    return label.charAt(0).toUpperCase() + label.slice(1).toLowerCase();
  }
  const stripped = stripMohallaPrefix(raw);
  return stripped.charAt(0).toUpperCase() + stripped.slice(1);
}

/** The route builder's collected definition, shared here so the two agree. */
export function isRouteStopCollected(stop = {}) {
  return stop.isCollected === true || stop.outcome === 'paid' || stop.outcome === 'partial';
}

function validDateStr(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/**
 * True when the stop's promise is broken on the route date: an
 * explicit waadaBroken flag, a promiseStatus of 'broken', or a
 * promiseDate before todayStr. A collected stop is never broken —
 * its promise is already settled. An invalid or missing promise
 * date is not broken; it is simply not a promise.
 */
export function isWaadaBroken(stop = {}, todayStr = '') {
  if (isRouteStopCollected(stop)) return false;
  if (stop.waadaBroken === true) return true;
  if (str(stop.promiseStatus).toLowerCase() === 'broken') return true;
  const promiseDate = str(stop.promiseDate || stop.waadaDate || '').trim();
  if (!validDateStr(promiseDate) || !validDateStr(todayStr)) return false;
  return promiseDate < todayStr;
}

/**
 * Pure: sequences one day's route stops. Never mutates its input or
 * any stop object; every returned stop is a shallow copy carrying
 * sequenceIndex (1-based, in sequenced order), originalIndex,
 * mohallaKey, mohallaLabel and waadaBroken.
 *
 * @param {Array} stops route stops (any objects with mohalla/area,
 *   totalDue, earliestUnpaidMonth, outcome/isCollected, promise fields)
 * @param {object} [options]
 * @param {string} [options.todayStr] route date YYYY-MM-DD; Waada
 *   brokenness is judged against it. Defaults to today's UTC date,
 *   which callers should override with the route's own date string.
 * @returns {{stops: Array, groups: Array}} sequenced stops and one
 *   summary per mohalla group, in walking order. Group totals sum
 *   exactly over that group's stops; pending figures cover
 *   uncollected stops only.
 */
export function sequenceRouteStops(stops = [], options = {}) {
  const list = Array.isArray(stops) ? stops : [];
  const todayStr = validDateStr(options.todayStr)
    ? options.todayStr
    : new Date().toISOString().slice(0, 10);

  const copies = list.map((stop, index) => {
    const copy = { ...(stop || {}) };
    copy.originalIndex = index;
    copy.mohallaKey = routeMohallaKey(copy);
    copy.mohallaLabel = routeMohallaLabel(copy);
    copy.waadaBroken = isWaadaBroken(copy, todayStr);
    return copy;
  });

  const groupMap = new Map();
  for (const stop of copies) {
    if (!groupMap.has(stop.mohallaKey)) {
      groupMap.set(stop.mohallaKey, {
        key: stop.mohallaKey,
        label: stop.mohallaLabel,
        stops: [],
        totalStops: 0,
        pendingStops: 0,
        totalDue: 0,
        pendingDue: 0,
      });
    }
    const group = groupMap.get(stop.mohallaKey);
    group.stops.push(stop);
    group.totalStops += 1;
    group.totalDue += num(stop.totalDue);
    if (!isRouteStopCollected(stop)) {
      group.pendingStops += 1;
      group.pendingDue += num(stop.totalDue);
    }
  }

  const groups = Array.from(groupMap.values()).sort((a, b) => {
    if (b.pendingDue !== a.pendingDue) return b.pendingDue - a.pendingDue;
    return a.label.localeCompare(b.label);
  });
  const groupRank = new Map(groups.map((group, index) => [group.key, index]));

  const sequenced = [...copies].sort((a, b) => {
    const rankA = groupRank.get(a.mohallaKey);
    const rankB = groupRank.get(b.mohallaKey);
    if (rankA !== rankB) return rankA - rankB;
    const collectedA = isRouteStopCollected(a);
    const collectedB = isRouteStopCollected(b);
    if (collectedA !== collectedB) return collectedA ? 1 : -1;
    if (a.waadaBroken !== b.waadaBroken) return a.waadaBroken ? -1 : 1;
    if (num(b.totalDue) !== num(a.totalDue)) return num(b.totalDue) - num(a.totalDue);
    const monthA = str(a.earliestUnpaidMonth || '');
    const monthB = str(b.earliestUnpaidMonth || '');
    if (monthA !== monthB) {
      if (!monthA) return 1;
      if (!monthB) return -1;
      return monthA < monthB ? -1 : 1;
    }
    const nameCmp = str(a.name || '').localeCompare(str(b.name || ''));
    if (nameCmp !== 0) return nameCmp;
    return a.originalIndex - b.originalIndex;
  });

  sequenced.forEach((stop, index) => {
    stop.sequenceIndex = index + 1;
  });

  return {
    stops: sequenced,
    groups: groups.map((group) => ({
      key: group.key,
      label: group.label,
      totalStops: group.totalStops,
      pendingStops: group.pendingStops,
      totalDue: group.totalDue,
      pendingDue: group.pendingDue,
    })),
  };
}

/**
 * Pure: returns sequenced copies in their original list order — the
 * fallback the plan requires. Copies are not mutated; the returned
 * array is a new array.
 */
export function restoreRouteOrder(sequencedStops = []) {
  const list = Array.isArray(sequencedStops) ? sequencedStops : [];
  return [...list].sort((a, b) => {
    const aIdx = Number.isFinite(num(a?.originalIndex)) ? num(a.originalIndex) : 0;
    const bIdx = Number.isFinite(num(b?.originalIndex)) ? num(b.originalIndex) : 0;
    return aIdx - bIdx;
  });
}
