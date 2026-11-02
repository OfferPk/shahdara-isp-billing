/**
 * uptime-tracking.js — Owner feature: Customer Uptime Tracking.
 *
 * Three questions the owner wants answered on every profile:
 *   1. How old is this profile/connection? (profile age stamp)
 *   2. How long was this customer online vs offline in a month?
 *   3. WHY were they offline? (the reason recorded with each offline period)
 *
 * Data sources — everything is reused, nothing is monitored or invented:
 *   - Offline periods come from the customer's own complaint/outage
 *     records (core.js incidents: offlineAt / restoredAt / note), which
 *     the admin already enters by hand on the profile.
 *   - They are joined by the customer's service-status history
 *     (customer.serviceStatusHistory, stamped by core.js whenever the
 *     manual service status flips): an "offline" stamp opens a period
 *     and the next non-offline stamp closes it.
 *   - The two sources are UNIONED before totalling, so a period that
 *     was recorded both ways is never double-counted.
 *   - SISP-189: a downstream subscriber may OPT IN to inherited
 *     upstream attribution — the recorded periods of every ancestor
 *     home on its daisy chain (upstreamCustomerId) join the same
 *     union, so time an upstream feeder outage and the customer's
 *     own recorded outage overlap is still counted exactly once.
 *     The default summary is untouched; inheritance is derived from
 *     the ancestors' own records, never monitored or estimated.
 *   - The live "in this status since" counter on the customer cards
 *     and the profile (currentStatusSession) reads the same status
 *     history, so the counter and the month summary cannot disagree.
 *
 * Month rule: a month counts only inside the connection's lifetime
 * (from connectionDate — or the profile-added date when no connection
 * date is recorded — to today, or to the recorded end date when the
 * connection has ended) and never past "now" for the current month.
 * Online = counted window − offline. The month's real calendar length
 * (28/29/30/31 days) is always reported alongside.
 *
 * All helpers are pure. Datetimes are Pakistan wall-clock strings
 * ('YYYY-MM-DDTHH:mm'), parsed with the same fixed UTC+5 convention as
 * core.js parseLocalDateTime. Tests use synthetic data only.
 */

import { summarizeCustomerTenure } from './core.js';
import { traceUpstreamChain } from './outage-impact.js';

const PKT_OFFSET_MS = 5 * 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;
const DAY_MINUTES = 24 * 60;
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DATETIME_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

/**
 * Parse a stored local datetime ('YYYY-MM-DDTHH:mm', Pakistan wall
 * clock) to epoch ms — the same convention as core.js. Null if invalid.
 */
export function parsePkDateTime(value) {
  const match = DATETIME_RE.exec(String(value ?? ''));
  if (!match) return null;
  const [, year, month, day, hour, minute] = match.map(Number);
  const wallClock = new Date(Date.UTC(year, month - 1, day, hour, minute));
  if (wallClock.getUTCFullYear() !== year || wallClock.getUTCMonth() !== month - 1 || wallClock.getUTCDate() !== day || wallClock.getUTCHours() !== hour || wallClock.getUTCMinutes() !== minute) return null;
  return wallClock.getTime() - PKT_OFFSET_MS;
}

/** Strict 'YYYY-MM-DD' calendar-date check (real dates only). */
export function isValidDateKey(value) {
  const match = DATE_RE.exec(String(value ?? ''));
  if (!match) return false;
  const [, year, month, day] = match.map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/** Epoch ms of Pakistan midnight at the start of a 'YYYY-MM-DD' day. */
function pkMidnightMs(dateKey) {
  const [, year, month, day] = DATE_RE.exec(dateKey).map(Number);
  return Date.UTC(year, month - 1, day) - PKT_OFFSET_MS;
}

/** The Pakistan calendar date ('YYYY-MM-DD') containing an instant. */
function pkDateKeyOf(ms) {
  const shifted = new Date(ms + PKT_OFFSET_MS);
  const year = shifted.getUTCFullYear();
  const month = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const day = String(shifted.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Real calendar length of a month: 28/29/30/31 (leap years honoured). */
export function daysInCalendarMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function parseDateKeyParts(dateKey) {
  const [, year, month, day] = DATE_RE.exec(dateKey).map(Number);
  return { year, month, day };
}

function dateKeyFromParts({ year, month, day }) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function addMonthsClamped(parts, months) {
  const index = parts.year * 12 + (parts.month - 1) + months;
  const year = Math.floor(index / 12);
  const month = (index % 12) + 1;
  const day = Math.min(parts.day, daysInCalendarMonth(year, month));
  return { year, month, day };
}

function dayDiff(fromKey, toKey) {
  return Math.round((pkMidnightMs(toKey) - pkMidnightMs(fromKey)) / (DAY_MINUTES * MINUTE_MS));
}

/**
 * Calendar breakdown between two dates: whole months + remaining days.
 * Returns { months, days, totalDays } or null when the range is empty
 * or inverted.
 */
export function calendarAgeBetween(fromKey, toKey) {
  if (!isValidDateKey(fromKey) || !isValidDateKey(toKey)) return null;
  const totalDays = dayDiff(fromKey, toKey);
  if (totalDays < 0) return null;
  const from = parseDateKeyParts(fromKey);
  const to = parseDateKeyParts(toKey);
  let months = (to.year - from.year) * 12 + (to.month - from.month);
  let anchor = addMonthsClamped(from, months);
  if (dateKeyFromParts(anchor) > toKey) {
    months -= 1;
    anchor = addMonthsClamped(from, months);
  }
  return { months, days: dayDiff(dateKeyFromParts(anchor), toKey), totalDays };
}

/**
 * Profile age stamp. The start point is the recorded connection date
 * (the same source of truth as the existing ISP-tenure summary in
 * core.js); when no connection date is recorded, the profile-added
 * date is used and the basis is reported honestly as 'profile'. When
 * neither exists the status is 'not-recorded' — a date is never
 * invented. Both stored start points are date-only, so the stamp is
 * months + days (no fabricated hours).
 *
 * Returns { status, basis, startDate, endDate, months, days, totalDays }
 * with nulls wherever an honest value does not exist. Status mirrors
 * summarizeCustomerTenure: 'current' | 'ended' | 'future' |
 * 'end-date-unknown' | 'date-review' | 'profile' | 'not-recorded'.
 */
export function summarizeProfileAge(customer, referenceDate = new Date()) {
  const tenure = summarizeCustomerTenure(customer, referenceDate);
  const todayKey = pkDateKeyOf(referenceDate.getTime());
  if (tenure.connectionDate) {
    if (tenure.status === 'future') {
      return { status: 'future', basis: 'connection', startDate: tenure.connectionDate, endDate: null, months: null, days: null, totalDays: null };
    }
    if (tenure.status === 'current' || tenure.status === 'ended') {
      const endKey = tenure.status === 'ended' ? tenure.endDate : todayKey;
      const age = calendarAgeBetween(tenure.connectionDate, endKey);
      if (age) return { status: tenure.status, basis: 'connection', startDate: tenure.connectionDate, endDate: tenure.status === 'ended' ? tenure.endDate : null, ...age };
    }
    return { status: tenure.status, basis: 'connection', startDate: tenure.connectionDate, endDate: tenure.endDate ?? null, months: null, days: null, totalDays: null };
  }
  if (tenure.profileAddedOn) {
    if (tenure.profileAddedOn > todayKey) {
      return { status: 'future', basis: 'profile', startDate: tenure.profileAddedOn, endDate: null, months: null, days: null, totalDays: null };
    }
    const archiveKey = customer?.archived === true && isValidDateKey(String(customer.archivedAt ?? '').slice(0, 10))
      ? String(customer.archivedAt).slice(0, 10)
      : null;
    const endKey = archiveKey && archiveKey >= tenure.profileAddedOn && archiveKey <= todayKey ? archiveKey : todayKey;
    const age = calendarAgeBetween(tenure.profileAddedOn, endKey);
    if (age) return { status: 'profile', basis: 'profile', startDate: tenure.profileAddedOn, endDate: archiveKey === endKey ? endKey : null, ...age };
  }
  return { status: 'not-recorded', basis: null, startDate: null, endDate: null, months: null, days: null, totalDays: null };
}

/** Split a whole-minute total into { days, hours, minutes, totalMinutes }. */
export function splitMinutes(totalMinutes) {
  const total = Math.max(0, Math.floor(Number(totalMinutes) || 0));
  return {
    days: Math.floor(total / DAY_MINUTES),
    hours: Math.floor((total % DAY_MINUTES) / 60),
    minutes: total % 60,
    totalMinutes: total
  };
}

const STATUS_VALUES = ['active', 'offline', 'not-set'];

/**
 * Tolerant reader for customer.serviceStatusHistory: keeps only
 * well-formed { status, at } entries with a parseable Pakistan
 * datetime, sorted oldest first. Legacy records without the field
 * read as an empty history.
 */
export function sanitizeServiceStatusHistory(value) {
  if (!Array.isArray(value)) return [];
  const entries = [];
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue;
    if (!STATUS_VALUES.includes(entry.status)) continue;
    const at = typeof entry.at === 'string' ? entry.at.trim() : '';
    const atMs = parsePkDateTime(at);
    if (atMs === null) continue;
    entries.push({ status: entry.status, at, atMs });
  }
  return entries.sort((a, b) => a.atMs - b.atMs || a.status.localeCompare(b.status));
}

/**
 * Every offline period the records describe, unclamped, oldest first:
 *   - source 'record': a complaint/outage record (offlineAt → restoredAt,
 *     null restoredAt = still open), reason = its note;
 *   - source 'status': a service-status history span (an 'offline'
 *     stamp → the next non-offline stamp, or open), reason = ''.
 * Malformed entries are skipped, never guessed at.
 */
export function collectOfflineIntervals(customer) {
  const intervals = [];
  for (const incident of customer?.incidents ?? []) {
    const startMs = parsePkDateTime(incident?.offlineAt);
    if (startMs === null) continue;
    let endMs = null;
    if (incident.restoredAt) {
      endMs = parsePkDateTime(incident.restoredAt);
      if (endMs === null || endMs < startMs) continue;
    }
    intervals.push({ startMs, endMs, reason: String(incident.note ?? '').trim(), source: 'record' });
  }
  const history = sanitizeServiceStatusHistory(customer?.serviceStatusHistory);
  let openStartMs = null;
  for (const entry of history) {
    if (entry.status === 'offline') {
      if (openStartMs === null) openStartMs = entry.atMs;
    } else if (openStartMs !== null) {
      intervals.push({ startMs: openStartMs, endMs: entry.atMs, reason: '', source: 'status' });
      openStartMs = null;
    }
  }
  if (openStartMs !== null) intervals.push({ startMs: openStartMs, endMs: null, reason: '', source: 'status' });
  return intervals.sort((a, b) => a.startMs - b.startMs);
}

/**
 * The customer's CURRENT service-status session: the status they are
 * in right now (customer.serviceStatus) and how long that session has
 * been running — the basis of the live "active/offline since" counter
 * on the customer cards and the profile.
 *
 * Precision rule (honesty — an hour figure is never invented):
 *   - 'datetime': the status history's newest stamp agrees with the
 *     current status. The session starts at the FIRST stamp of the
 *     trailing run of same-status entries (core.js appends only on a
 *     real flip; consecutive duplicates can still arrive via backup
 *     merges, so the run — not the single last entry — is the start).
 *     days/hours/minutes are exact from that stamp.
 *   - 'date': no usable history stamp (a legacy record, or history
 *     whose newest stamp disagrees with the current status). An
 *     ACTIVE customer with a recorded connection date — else the
 *     profile-added date — gets a date-level session: whole days
 *     only, hours/minutes stay null. An OFFLINE customer without a
 *     stamp has no honest start at all: precision stays null and the
 *     surfaces show no counter (the month summary still reports the
 *     recorded offline periods).
 *   - 'not-set' customers never have a session.
 *
 * Returns { status, since, sinceMs, precision, sinceDate,
 *           days, hours, minutes, totalMinutes } — nulls wherever an
 * honest value does not exist.
 */
export function currentStatusSession(customer, referenceDate = new Date()) {
  const status = STATUS_VALUES.includes(customer?.serviceStatus) ? customer.serviceStatus : 'not-set';
  const base = { status, since: null, sinceMs: null, precision: null, sinceDate: null, days: null, hours: null, minutes: null, totalMinutes: null };
  if (status === 'not-set') return base;
  const nowMs = referenceDate.getTime();
  const history = sanitizeServiceStatusHistory(customer?.serviceStatusHistory);
  if (history.length && history[history.length - 1].status === status) {
    let runStart = history[history.length - 1];
    for (let i = history.length - 1; i >= 0 && history[i].status === status; i--) runStart = history[i];
    const totalMinutes = Math.max(0, Math.floor((nowMs - runStart.atMs) / MINUTE_MS));
    return { status, since: runStart.at, sinceMs: runStart.atMs, precision: 'datetime', sinceDate: null, ...splitMinutes(totalMinutes) };
  }
  if (status === 'active') {
    const tenure = summarizeCustomerTenure(customer, referenceDate);
    const startKey = tenure.connectionDate ?? tenure.profileAddedOn ?? null;
    if (startKey && isValidDateKey(startKey)) {
      const days = dayDiff(startKey, pkDateKeyOf(nowMs));
      if (days >= 0) {
        return { status, since: null, sinceMs: null, precision: 'date', sinceDate: startKey, days, hours: null, minutes: null, totalMinutes: days * DAY_MINUTES };
      }
    }
  }
  return base;
}

/**
 * One live-counter tick: rewrite ONLY the text of the counter nodes
 * under a root — the nodes survive untouched as elements (no
 * re-render), so a 98-card list stays cheap. Deliberately DOM-light
 * (querySelectorAll + dataset + textContent) and dependency-injected,
 * so the customers list, the profile and the tests all drive the same
 * updater. formatText(customer, now) must return the full counter
 * line ('' hides it — an existing node's text is cleared, the node
 * itself is never removed or replaced). Returns how many nodes
 * actually changed.
 */
export function refreshLiveSessionCounters(root, { getCustomer, formatText, now = new Date() } = {}) {
  if (!root || typeof root.querySelectorAll !== 'function' || typeof getCustomer !== 'function' || typeof formatText !== 'function') return 0;
  let updated = 0;
  for (const node of root.querySelectorAll('[data-live-session-for]')) {
    const customer = getCustomer(node?.dataset?.liveSessionFor);
    if (!customer) continue;
    const text = String(formatText(customer, now) ?? '');
    if (node.textContent !== text) {
      node.textContent = text;
      updated += 1;
    }
  }
  return updated;
}

/**
 * SISP-189: the daisy-chain ancestors of one customer, nearest first
 * (the direct upstream home, then its upstream, up to the root).
 * Follows customer.upstreamCustomerId through the roster with a
 * visited-set cycle guard: a pre-existing A<->B link cycle terminates
 * with each home listed at most once, and a dangling id (an upstream
 * that is not in the roster) simply ends the chain. Archived homes
 * are traversed and listed like any other — the chain physically ran
 * through them (the same treatment traceDownstreamImpact gives
 * archived homes on the way down). Pure; never mutates.
 */
/* SISP-189 ancestor walk: COMPOSED onto SISP-188's shared
 * traceUpstreamChain (outage-impact.js) at the post-188 merge — the
 * build's local collectUpstreamAncestors was deleted so the app keeps
 * exactly ONE upstream walk. Semantics on every real call path are
 * identical (the subject is always a roster member here); the shared
 * walk resolves the subject by id in the roster and returns [] for
 * an unknown id. */

/**
 * One customer's recorded offline periods inside a counted window:
 * raw intervals from collectOfflineIntervals, clamped to the window,
 * each with its own minutes — plus the plain [startMs, endMs] spans
 * the union total is computed from. Shared verbatim by the customer's
 * own summary and by every ancestor's inherited contribution, so an
 * inherited period is derived exactly the way an own period is.
 */
function collectWindowPeriods(sourceCustomer, windowStartMs, windowEndMs) {
  const periods = [];
  const spans = [];
  for (const interval of collectOfflineIntervals(sourceCustomer)) {
    const startMs = Math.max(interval.startMs, windowStartMs);
    const endMs = Math.min(interval.endMs ?? windowEndMs, windowEndMs);
    if (endMs <= startMs) continue;
    spans.push([startMs, endMs]);
    periods.push({
      startMs,
      endMs,
      open: interval.endMs === null,
      minutes: Math.floor((endMs - startMs) / MINUTE_MS),
      reason: interval.reason,
      source: interval.source
    });
  }
  return { periods, spans };
}

/** Total minutes covered by the UNION of [startMs, endMs] spans. */
function unionMinutes(spans) {
  if (!spans.length) return 0;
  const sorted = [...spans].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  let totalMs = 0;
  let [openStart, openEnd] = sorted[0];
  for (let i = 1; i < sorted.length; i++) {
    const [start, end] = sorted[i];
    if (start > openEnd) {
      totalMs += openEnd - openStart;
      openStart = start;
      openEnd = end;
    } else if (end > openEnd) {
      openEnd = end;
    }
  }
  totalMs += openEnd - openStart;
  return Math.floor(totalMs / MINUTE_MS);
}

/**
 * Month-end uptime summary for one customer and one 'YYYY-MM' month.
 *
 * The counted window is the month itself, clamped to the connection's
 * lifetime (connectionDate, else profile-added date, else unclamped)
 * and to "now" — a future month, or the part of this month that has
 * not happened yet, is never counted. When the connection has a
 * recorded end date (summarizeCustomerTenure 'ended'), the window
 * stops at the end of that day. Offline minutes are the union of the
 * recorded periods inside the window; online = window − offline.
 *
 * periods lists each recorded offline period that overlaps the window,
 * clamped to it, newest first, with its own minutes and reason —
 * overlapping periods are listed individually (their minutes describe
 * the record) while the offline total stays unioned, never doubled.
 *
 * SISP-189 opt-in: pass options { includeInherited: true, customers }
 * (the full roster) and the summary gains inheritedUpstreamPeriods —
 * every daisy-chain ancestor's own recorded periods inside the same
 * window, each stamped with its source ancestor's id/name/number —
 * plus inheritedAncestors (the chain, nearest first). The offline /
 * online totals then come from the single union of own + inherited
 * spans. Without the option the result is exactly the legacy summary.
 */
export function buildMonthlyUptime(customer, month, referenceDate = new Date(), options = {}) {
  if (!MONTH_RE.test(String(month ?? ''))) throw new Error('Choose a valid month (YYYY-MM) for the uptime summary.');
  const [year, monthNumber] = String(month).split('-').map(Number);
  const daysInMonth = daysInCalendarMonth(year, monthNumber);
  const monthStartMs = pkMidnightMs(`${month}-01`);
  const monthEndMs = monthStartMs + daysInMonth * DAY_MINUTES * MINUTE_MS;
  const nowMinuteMs = Math.floor(referenceDate.getTime() / MINUTE_MS) * MINUTE_MS;

  const tenure = summarizeCustomerTenure(customer, referenceDate);
  const lifetimeStartKey = tenure.connectionDate ?? tenure.profileAddedOn ?? null;
  let windowStartMs = monthStartMs;
  if (lifetimeStartKey) windowStartMs = Math.max(windowStartMs, pkMidnightMs(lifetimeStartKey));
  let windowEndMs = Math.min(monthEndMs, nowMinuteMs);
  if (tenure.status === 'ended' && tenure.endDate) {
    windowEndMs = Math.min(windowEndMs, pkMidnightMs(tenure.endDate) + DAY_MINUTES * MINUTE_MS);
  }
  const windowMinutes = Math.max(0, Math.floor((windowEndMs - windowStartMs) / MINUTE_MS));

  const intervals = collectOfflineIntervals(customer);
  const { periods, spans } = collectWindowPeriods(customer, windowStartMs, windowEndMs);
  periods.sort((a, b) => b.startMs - a.startMs);

  // SISP-189 (opt-in only): inherited upstream periods. Each ancestor's
  // recorded periods are derived by the very same collectWindowPeriods
  // path and clipped to THIS customer's counted window — the window
  // stays the connection's own, so inherited minutes can never exceed
  // it — and every span (own + inherited) enters ONE union, so any
  // overlap counts its minutes exactly once. With the option off the
  // summary gains no keys and its figures are exactly today's.
  const includeInherited = options?.includeInherited === true;
  let inheritedUpstreamPeriods = null;
  let inheritedAncestors = null;
  let totalSpans = spans;
  if (includeInherited) {
    const roster = Array.isArray(options?.customers) ? options.customers : [];
    const ancestors = traceUpstreamChain(roster, customer?.id);
    inheritedAncestors = ancestors.map((ancestor) => ({
      id: String(ancestor.id),
      name: String(ancestor.name ?? ''),
      customerNumber: ancestor.customerNumber ?? null,
      archived: ancestor.archived === true
    }));
    inheritedUpstreamPeriods = [];
    totalSpans = [...spans];
    for (const ancestor of ancestors) {
      const inherited = collectWindowPeriods(ancestor, windowStartMs, windowEndMs);
      totalSpans.push(...inherited.spans);
      for (const period of inherited.periods) {
        inheritedUpstreamPeriods.push({
          ...period,
          inherited: true,
          ancestorId: String(ancestor.id),
          ancestorName: String(ancestor.name ?? ''),
          ancestorNumber: ancestor.customerNumber ?? null
        });
      }
    }
    inheritedUpstreamPeriods.sort((a, b) => b.startMs - a.startMs);
  }

  const offlineMinutes = windowMinutes > 0 ? unionMinutes(totalSpans) : 0;
  const onlineMinutes = Math.max(0, windowMinutes - offlineMinutes);

  let openSinceMs = null;
  for (const interval of intervals) {
    if (interval.endMs === null && interval.startMs <= nowMinuteMs) {
      openSinceMs = openSinceMs === null ? interval.startMs : Math.min(openSinceMs, interval.startMs);
    }
  }

  const summary = {
    month,
    daysInMonth,
    windowMinutes,
    onlineMinutes,
    offlineMinutes,
    online: splitMinutes(onlineMinutes),
    offline: splitMinutes(offlineMinutes),
    window: splitMinutes(windowMinutes),
    lifetimeClamped: windowStartMs > monthStartMs,
    lifetimeStart: lifetimeStartKey,
    periods,
    openSinceMs
  };
  if (includeInherited) {
    summary.inheritedUpstreamPeriods = inheritedUpstreamPeriods;
    summary.inheritedAncestors = inheritedAncestors;
  }
  return summary;
}

/**
 * SISP-184: chronic-offline display rule for the fleet card. A counted
 * subscriber is flagged chronic when their recorded uptime for the
 * month falls below 95% OR they were offline for 24 hours or more in
 * total. It is a display rule for the dashboard card only — it is not
 * an SLA threshold, a promise, or a billing input.
 */
export const FLEET_CHRONIC_UPTIME_PERCENT = 95;
export const FLEET_CHRONIC_OFFLINE_MINUTES = 24 * 60;

/**
 * Fleet-wide uptime for one 'YYYY-MM' month, aggregated ONLY from
 * buildMonthlyUptime — the same per-customer summary the profile
 * shows — so the fleet figures can never disagree with a profile.
 *
 * Population: active subscribers (archived excluded). FREE
 * connections are included: uptime is about service, not fees.
 * A subscriber whose counted window for the month is empty (the
 * connection starts after the month, or ended before it) cannot be
 * scored honestly: they are EXCLUDED from the average and reported
 * in `excluded` — never dropped silently, never scored as 100%.
 *
 * uptimePercent per subscriber = onlineMinutes / windowMinutes × 100,
 * rounded to 1 decimal. fleetAvgPercent is the plain MEAN of those
 * per-subscriber percentages (each subscriber counts once, however
 * long their counted window is), rounded to 1 decimal; null when no
 * subscriber could be counted. rows are the counted subscribers
 * sorted by uptime ascending (ties by customerNumber), lowestFive is
 * the head of that list.
 */
export function buildFleetUptime(customers, month, referenceDate = new Date()) {
  if (!MONTH_RE.test(String(month ?? ''))) throw new Error('Choose a valid month (YYYY-MM) for the fleet uptime summary.');
  const rows = [];
  const excluded = [];
  for (const customer of customers ?? []) {
    if (!customer || customer.archived === true) continue;
    const summary = buildMonthlyUptime(customer, month, referenceDate);
    if (summary.windowMinutes <= 0) {
      excluded.push({ customerId: customer.id, customerNumber: customer.customerNumber ?? null });
      continue;
    }
    const uptimePercent = Math.round((summary.onlineMinutes / summary.windowMinutes) * 1000) / 10;
    rows.push({
      customerId: customer.id,
      customerNumber: customer.customerNumber ?? null,
      name: String(customer.name ?? ''),
      mohalla: String(customer.mohalla ?? ''),
      isFreeConnection: customer.isFreeConnection === true,
      uptimePercent,
      onlineMinutes: summary.onlineMinutes,
      offlineMinutes: summary.offlineMinutes,
      windowMinutes: summary.windowMinutes,
      lifetimeClamped: summary.lifetimeClamped,
      chronic: uptimePercent < FLEET_CHRONIC_UPTIME_PERCENT || summary.offlineMinutes >= FLEET_CHRONIC_OFFLINE_MINUTES
    });
  }
  rows.sort((a, b) => (a.uptimePercent - b.uptimePercent)
    || ((a.customerNumber ?? Number.POSITIVE_INFINITY) - (b.customerNumber ?? Number.POSITIVE_INFINITY))
    || String(a.customerId).localeCompare(String(b.customerId)));
  const perfectCount = rows.filter(row => row.offlineMinutes === 0).length;
  const chronicCount = rows.filter(row => row.chronic).length;
  const fleetAvgPercent = rows.length
    ? Math.round((rows.reduce((sum, row) => sum + row.uptimePercent, 0) / rows.length) * 10) / 10
    : null;
  return {
    month: String(month),
    includedCount: rows.length,
    excludedCount: excluded.length,
    excluded,
    perfectCount,
    chronicCount,
    fleetAvgPercent,
    rows,
    lowestFive: rows.slice(0, 5)
  };
}
