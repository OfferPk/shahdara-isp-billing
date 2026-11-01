/**
 * root-cause-advisor.js — SISP-123: Repeat-Category Root-Cause Engineering
 * Prescription.
 *
 * Problem: the same fault keeps coming back for the same customer — the
 * charger dies again, the same span gets cut again — and every visit just
 * repeats the temporary repair. When a customer logs >= 2 faults in the
 * SAME category within 60 days, this module prescribes the permanent
 * engineering fix for that category (e.g. 2x "Media Converter / Charger
 * Off" -> "Install 12V Mini-UPS or Migrate to Passive PLC Splitter").
 *
 * STRICTLY DERIVED + READ-ONLY: the advice is a pure function of the two
 * shipped ledgers (SISP-15 complaint register + SISP-12 field tickets).
 * Nothing is stored, stamped or migrated — when the repeat pair ages out
 * of the window the advice simply stops being derived.
 *
 * Counting rules (data honesty):
 *   - Sources: register complaints (issueCategory + reportedAt) and field
 *     tickets (faultPreset + createdAt). Status NEVER gates the count —
 *     a repeat fault is a repeat fault, open or resolved.
 *   - Dedup (SISP-44): a ticket whose complaintId names a complaint that
 *     is present in the register list IS that complaint — it is never
 *     counted as a second fault. Only standalone tickets add events.
 *   - Grouping is exact recorded-value equality, never free-text
 *     guessing: complaints group by their recorded issueCategory.
 *     Standalone tickets join a register category ONLY through the
 *     shipped COMPLAINT_CATEGORY_TO_PRESET equivalence read backwards
 *     where it is unambiguous ('Media Converter Power/Charger' ->
 *     'Media Converter / Charger Off', 'Router / IP Conflict' ->
 *     'Router / Wi-Fi Config', 'CAT6 / RJ45 Fault' ->
 *     'CAT6 / Connector Fault'). The 'Fiber Cut / Splice Loss' preset
 *     maps back to TWO register categories, so standalone fiber tickets
 *     form their own preset-labelled group instead of guessing one;
 *     'Slow Speed / High Attenuation' has no register category and also
 *     groups under its own preset label. Custom-fault tickets carry no
 *     recorded category and never group.
 *   - Window: rolling 60 days, the recurringTicketCount precedent — the
 *     trigger fires when >= 2 events of a group fall inside the
 *     trailing 60-day window ending at the reference instant (so the
 *     pair is necessarily <= 60 days apart, and the advice ages out on
 *     its own once the repeats stop). Records with a missing/invalid
 *     date never count, and neither do records dated after the
 *     reference instant. Dates are the ledgers' own "YYYY-MM-DDTHH:MM"
 *     PKT wall-clock strings, parsed exactly like the shipped modules
 *     parse them (computeDowntimeHours / recurringTicketCount).
 *   - AREA_OUTAGE register rows belong to no customer and never advise.
 *
 * Recommendation table: a category earns a banner ONLY when a deliberate
 * permanent fix exists for it (ROOT_CAUSE_FIX_KEYS). Deliberately
 * UNMAPPED (no banner, ever): 'Other' (free-form — no honest specific
 * fix) and 'Main Uplink / NayaPay Down' (provider-side; the remedy is
 * the upstream SLA/rebate path, not a per-customer engineering fix).
 * The prescription strings themselves are UI strings (rca_fix_* i18n
 * keys, en + ur); category labels render as recorded.
 *
 * This module imports only nav-language.js on purpose: complaint
 * records are read defensively field-by-field instead of importing the
 * register/ticket sanitizers, so complaint-register.js and
 * complaint-tickets.js can both import this module with no cycle.
 */

import { t } from './nav-language.js';

export const ROOT_CAUSE_WINDOW_DAYS = 60;

const AREA_OUTAGE_CUSTOMER_ID = 'AREA_OUTAGE';
const DATE_TIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
const DAY_MS = 24 * 3600 * 1000;

/**
 * Group key -> rca_fix_* i18n key. A group absent here NEVER produces
 * advice, no matter how often it repeats.
 */
export const ROOT_CAUSE_FIX_KEYS = {
  'Media Converter / Charger Off': 'rca_fix_media_converter',
  'Fiber Cut': 'rca_fix_fiber_cut',
  'Fiber Splice Loss': 'rca_fix_fiber_splice_loss',
  'Fiber Cut / Splice Loss': 'rca_fix_fiber_cut_splice',
  'Router / Wi-Fi Config': 'rca_fix_router_config',
  'CAT6 / Connector Fault': 'rca_fix_cat6_connector',
  'WAPDA / Power Outage': 'rca_fix_wapda_power',
  'Slow Speed / High Attenuation': 'rca_fix_slow_speed'
};

/**
 * Standalone-ticket preset -> fault group key. Mirrors the shipped
 * COMPLAINT_CATEGORY_TO_PRESET (complaint-tickets.js) read backwards;
 * see the header for why the fiber preset keeps its own label.
 */
const TICKET_PRESET_GROUPS = {
  'Media Converter Power/Charger': 'Media Converter / Charger Off',
  'Router / IP Conflict': 'Router / Wi-Fi Config',
  'CAT6 / RJ45 Fault': 'CAT6 / Connector Fault',
  'Fiber Cut / Splice Loss': 'Fiber Cut / Splice Loss',
  'Slow Speed / High Attenuation': 'Slow Speed / High Attenuation'
};

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Parse a ledger "YYYY-MM-DDTHH:MM" stamp; null when missing/invalid. */
function parseLedgerTime(value) {
  const text = cleanText(value);
  if (!DATE_TIME_RE.test(text)) return null;
  const ts = Date.parse(text);
  return Number.isFinite(ts) ? ts : null;
}

function referenceTime(referenceDate) {
  if (referenceDate instanceof Date && !Number.isNaN(referenceDate.getTime())) {
    return referenceDate.getTime();
  }
  if (typeof referenceDate === 'string') {
    const ts = Date.parse(referenceDate);
    if (Number.isFinite(ts)) return ts;
  }
  return Date.now();
}

/** Fault group key for a register complaint (its recorded category). */
export function complaintFaultGroup(complaint) {
  const category = cleanText(complaint?.issueCategory);
  return category || null;
}

/** Fault group key for a field ticket (recorded preset only). */
export function ticketFaultGroup(ticket) {
  const preset = cleanText(ticket?.faultPreset);
  return Object.prototype.hasOwnProperty.call(TICKET_PRESET_GROUPS, preset)
    ? TICKET_PRESET_GROUPS[preset]
    : null;
}

/**
 * The deduped fault events of one customer across both ledgers:
 * [{ group, date, ts, source, id }] sorted newest first. A ticket
 * linked (SISP-44 complaintId) to a complaint present in the register
 * list contributes NO event — the complaint is the event.
 */
export function faultEventsForCustomer(complaints, tickets, customerId) {
  const wanted = String(customerId ?? '');
  if (!wanted || wanted === AREA_OUTAGE_CUSTOMER_ID) return [];
  const complaintList = Array.isArray(complaints) ? complaints : [];
  const ticketList = Array.isArray(tickets) ? tickets : [];
  const knownComplaintIds = new Set(
    complaintList.map((c) => cleanText(c?.id)).filter(Boolean)
  );
  const events = [];
  for (const complaint of complaintList) {
    if (!complaint || String(complaint.customerId ?? '') !== wanted) continue;
    const group = complaintFaultGroup(complaint);
    if (!group) continue;
    const ts = parseLedgerTime(complaint.reportedAt);
    if (ts === null) continue;
    events.push({ group, date: cleanText(complaint.reportedAt), ts, source: 'complaint', id: cleanText(complaint.id) });
  }
  for (const ticket of ticketList) {
    if (!ticket || String(ticket.customerId ?? '') !== wanted) continue;
    const link = cleanText(ticket.complaintId);
    if (link && knownComplaintIds.has(link)) continue; // SISP-44 pair = one fault
    const group = ticketFaultGroup(ticket);
    if (!group) continue;
    const ts = parseLedgerTime(ticket.createdAt);
    if (ts === null) continue;
    events.push({ group, date: cleanText(ticket.createdAt), ts, source: 'ticket', id: cleanText(ticket.id) });
  }
  return events.sort((a, b) => b.ts - a.ts || String(b.id).localeCompare(String(a.id)));
}

/**
 * Root-cause advice for one customer: one entry per fault group with
 * >= 2 events inside the trailing 60-day window ending at the
 * reference instant (and a mapped permanent fix). Pure — inputs are
 * never mutated.
 * -> [{ group, category, count, latestDate, previousDate, daysApart, fixKey }]
 */
export function rootCauseAdviceForCustomer(ledgers, customerId, referenceDate = new Date()) {
  const { complaints, tickets } = ledgers && typeof ledgers === 'object' ? ledgers : {};
  const ref = referenceTime(referenceDate);
  const windowMs = ROOT_CAUSE_WINDOW_DAYS * DAY_MS;
  const events = faultEventsForCustomer(complaints, tickets, customerId)
    .filter((event) => event.ts <= ref && ref - event.ts <= windowMs);
  const byGroup = new Map();
  for (const event of events) {
    if (!byGroup.has(event.group)) byGroup.set(event.group, []);
    byGroup.get(event.group).push(event);
  }
  const advice = [];
  for (const [group, groupEvents] of byGroup) {
    const fixKey = ROOT_CAUSE_FIX_KEYS[group];
    if (!fixKey) continue; // no honest permanent fix mapped -> no banner
    if (groupEvents.length < 2) continue;
    const [latest, previous] = groupEvents;
    advice.push({
      group,
      category: group,
      count: groupEvents.length,
      latestDate: latest.date,
      previousDate: previous.date,
      daysApart: Math.round((latest.ts - previous.ts) / DAY_MS),
      fixKey
    });
  }
  return advice.sort((a, b) => String(b.latestDate).localeCompare(String(a.latestDate)));
}

/**
 * Banner HTML for a list of advice entries ('' when none). Used on the
 * customer profile; the register/ticket surfaces filter the customer's
 * advice to the card's own fault group and reuse the same markup.
 */
export function rootCauseBannerHtml(adviceList) {
  const entries = Array.isArray(adviceList) ? adviceList : [];
  if (!entries.length) return '';
  return entries.map((entry) => `
    <div class="root-cause-banner" role="alert">
      <div class="root-cause-title">🔧 ${escapeHtml(t('rca_title'))}</div>
      <p class="root-cause-body">${escapeHtml(t('rca_body', null, { count: entry.count, category: entry.category }))}</p>
      <p class="root-cause-fix">${escapeHtml(t(entry.fixKey))}</p>
    </div>`).join('');
}
