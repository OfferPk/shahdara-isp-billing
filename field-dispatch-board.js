/**
 * field-dispatch-board.js — SISP-67 [P1]: Unified Zone Field Dispatch
 * Board ("زون فیلڈ ڈسپیچ بورڈ").
 *
 * Spec (read-latest.txt, SISP-67 block): "Combine open items from
 * Pending Works (PR #423), Installation Tracker (PR #419),
 * Complaints/Tickets (SISP-15/12), and Pending Hardware Recovery
 * (SISP-19) grouped by Mohalla/Zone … with a 1-tap 'Send Zone
 * Worklist to Saad on WhatsApp' button." Test criterion: "Having 1
 * open complaint, 1 pending installation, and 1 pending work item in
 * 'Barrian' groups all 3 under the Barrian card and includes all 3 in
 * the WhatsApp dispatch summary."
 *
 * This module is a PURE, READ-ONLY aggregator in the
 * collection-forecaster.js / upsell-optimizer.js mould: it reads the
 * four source collections through their own sanitizers / derived
 * helpers, groups the OPEN items by zone, and returns figures +
 * ready-to-render rows + a WhatsApp dispatch text/URL per zone. It
 * writes nothing, mutates nothing, adds NO storage keys, and never
 * touches the source modules' stores — every count here can be
 * reproduced from the source screens themselves.
 *
 * Definitions (pinned by tests/field-dispatch-board.test.js):
 *  1. OPEN items only:
 *     - complaints (SISP-15 register): status !== 'Resolved';
 *     - tickets (SISP-12): status !== 'Resolved';
 *     - installations: requestStatus(request) === 'Pending' (no
 *       installDate yet — the tracker module's own derivation);
 *     - pending works: status === 'pending' (the module's own flag);
 *     - hardware recovery: pendingHardwareRecovery(customers) — the
 *       SISP-19 derivation (disconnected + ISP-owned item not yet
 *       recovered). One board item per CUSTOMER, its detail naming
 *       the outstanding items.
 *  2. NO DOUBLE COUNTING of linked field work: a ticket carrying a
 *     complaintId is the field-work unit for that complaint (SISP-44
 *     keeps the two in sync), so an OPEN complaint that an OPEN
 *     ticket already covers is listed once — as the ticket. An open
 *     complaint with no open ticket (or whose linked ticket is
 *     resolved) still lists as a complaint.
 *  3. ZONE of an item, resolved through canonicalMohalla (phase3.js)
 *     so spelling variants merge exactly like Feature 1's Area
 *     search and the SISP-54 area bars:
 *     - complaint: its own recorded zone first, else the linked
 *       customer's mohalla/zone (AREA_OUTAGE complaints carry their
 *       zone on the record itself);
 *     - ticket / installation / recovery: the linked customer's
 *       mohalla (falling back to the customer's zone field);
 *     - pending work: pending-works records carry no customer or
 *       zone field, so the zone is the canonical mohalla NAMED in
 *       the note/source text (first match wins, multi-word names
 *       included) — the way an operator writes "Barrian pole work"
 *       in the note. No name in the text → unassigned.
 *     Items whose zone cannot be resolved land in ONE trailing
 *     "unassigned" group (key 'unassigned', label '') so no open
 *     work is ever silently dropped from the board.
 *  4. GROUPS: only zones with at least one open item appear, sorted
 *     by open-item count (busiest first), then by label; the
 *     unassigned group always sorts last. Items inside a zone are
 *     grouped in a fixed type order (complaint, ticket, installation,
 *     work, recovery) and keep source order within a type.
 *  5. DISPATCH: buildZoneDispatchSummary(zone) is the deterministic
 *     Roman-Urdu worklist text (zone heading + per-type sections +
 *     one line per item). buildZoneDispatchUrl(zone, phone) routes
 *     it through the house formatWhatsAppUrl when a recipient number
 *     is supplied (and valid); with no number it falls back to the
 *     wa.me/?text= share URL the shipped staff summaries use
 *     (dashboard-daily-closing.js / dashboard-collection-target.js),
 *     so the operator picks the contact (Saad) in WhatsApp. The
 *     module hardcodes NO personal number — none exists in the
 *     codebase for Saad dispatch.
 *
 * Imported ONLY by app.js (perf budget #219: esbuild inlines it into
 * the app chunk; dist stays at 25 bundled files).
 */
import { canonicalMohalla, DEFAULT_MOHALLAS } from './phase3.js';
import { formatWhatsAppUrl } from './form-validation.js';
import { sanitizeComplaints, complaintCustomerLabel, AREA_OUTAGE_CUSTOMER_ID } from './complaint-register.js';
import { sanitizeTickets, ticketFaultLabel } from './complaint-tickets.js';
import { sanitizeInstallRequests, requestStatus, requestNameLabel } from './install-tracker.js';
import { sanitizePendingWorks } from './pending-works.js';
import { pendingHardwareRecovery } from './hardware-custody.js';

export const DISPATCH_ITEM_TYPES = ['complaint', 'ticket', 'installation', 'work', 'recovery'];
export const UNASSIGNED_ZONE_KEY = 'unassigned';

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

/** Canonical zone { key, label } for a raw mohalla/zone value, or null. */
function zoneOf(raw) {
  const canon = canonicalMohalla(raw);
  if (!canon || !canon.key) return null;
  return { key: canon.key, label: canon.stored };
}

/** A customer's zone: mohalla first, then the legacy zone field. */
function customerZone(customer) {
  if (!customer || typeof customer !== 'object') return null;
  return zoneOf(customer.mohalla) || zoneOf(customer.zone);
}

const CANONICAL_MOHALLA_KEYS = new Set(
  DEFAULT_MOHALLAS.map((name) => canonicalMohalla(name)?.key).filter(Boolean)
);

/**
 * Zone named inside free text (pending-work notes): the first
 * canonical mohalla whose name appears, checking adjacent word pairs
 * and triples too so multi-word names ("PULL SIDE", "MOHALLA
 * CHUDRIYAA", "Mohalla end side farm house") match like single ones.
 * Comparison goes through canonicalMohalla itself, so aliases
 * (Bani → BANII, Chamyaa → CHAMYAAA) fold exactly as elsewhere, and a
 * stray word that merely keeps its own key (any unmatched text) is
 * NOT a zone — only names on the owner's canonical list match.
 */
function zoneNamedInText(text) {
  const words = cleanText(text)
    .split(/\s+/)
    .map((word) => word.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ''))
    .filter(Boolean);
  if (words.length === 0) return null;
  for (let i = 0; i < words.length; i += 1) {
    for (let span = Math.min(4, words.length - i); span >= 1; span -= 1) {
      const zone = zoneOf(words.slice(i, i + span).join(' '));
      if (zone && CANONICAL_MOHALLA_KEYS.has(zone.key)) return zone;
    }
  }
  return null;
}

function customerIndex(customers) {
  const byId = new Map();
  for (const customer of Array.isArray(customers) ? customers : []) {
    if (customer && customer.id !== null && customer.id !== undefined && customer.id !== '') {
      byId.set(String(customer.id), customer);
    }
  }
  return byId;
}

function emptyCounts() {
  return { complaint: 0, ticket: 0, installation: 0, work: 0, recovery: 0 };
}

/**
 * Build the whole board. `state` supplies customers; `sources`
 * supplies the four raw collections (callers pass the modules' own
 * loader output; every collection is re-sanitized here so stale or
 * malformed rows can never break the board).
 *
 * Returns { zones: [{ key, label, totalCount, counts, items,
 * summary, whatsappUrl }], totalOpen, counts, unassignedCount }.
 * Each item: { type, id, title, detail, customerId }.
 */
export function buildFieldDispatchBoard(state, sources = {}) {
  const customers = state && Array.isArray(state.customers) ? state.customers : [];
  const src = sources && typeof sources === 'object' ? sources : {};
  const byId = customerIndex(customers);
  const complaints = sanitizeComplaints(src.complaints);
  const tickets = sanitizeTickets(src.tickets);
  const installRequests = sanitizeInstallRequests(src.installRequests);
  const pendingWorks = sanitizePendingWorks(src.pendingWorks);

  const groups = new Map();
  const groupFor = (zone) => {
    const key = zone ? zone.key : UNASSIGNED_ZONE_KEY;
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        label: zone ? zone.label : '',
        totalCount: 0,
        counts: emptyCounts(),
        items: []
      });
    }
    return groups.get(key);
  };
  const addItem = (zone, item) => {
    const group = groupFor(zone);
    group.items.push(item);
    group.counts[item.type] += 1;
    group.totalCount += 1;
  };

  // Open tickets first: they mark which complaints they already cover.
  const openTickets = tickets.filter((ticket) => ticket.status !== 'Resolved');
  const coveredComplaintIds = new Set(
    openTickets.map((ticket) => cleanText(ticket.complaintId)).filter(Boolean)
  );

  for (const complaint of complaints) {
    if (complaint.status === 'Resolved') continue;
    if (coveredComplaintIds.has(complaint.id)) continue;
    const customer = complaint.customerId && complaint.customerId !== AREA_OUTAGE_CUSTOMER_ID
      ? byId.get(String(complaint.customerId))
      : null;
    const zone = zoneOf(complaint.zone) || customerZone(customer);
    addItem(zone, {
      type: 'complaint',
      id: complaint.id,
      title: complaintCustomerLabel(complaint),
      detail: [complaint.issueCategory, complaint.reportedAt].filter(Boolean).join(' · '),
      customerId: customer ? String(customer.id) : ''
    });
  }

  for (const ticket of openTickets) {
    const customer = byId.get(String(ticket.customerId));
    addItem(customerZone(customer), {
      type: 'ticket',
      id: ticket.id,
      title: ticket.customerName || (customer ? cleanText(customer.name) : ''),
      detail: [ticketFaultLabel(ticket), ticket.priority === 'Urgent' ? 'Urgent' : ''].filter(Boolean).join(' · '),
      customerId: customer ? String(customer.id) : ''
    });
  }

  for (const request of installRequests) {
    if (requestStatus(request) !== 'Pending') continue;
    const customer = request.customerId ? byId.get(String(request.customerId)) : null;
    addItem(customerZone(customer), {
      type: 'installation',
      id: request.id,
      title: requestNameLabel(request),
      detail: [request.requestDate ? `Requested ${request.requestDate}` : '', request.phone || ''].filter(Boolean).join(' · '),
      customerId: customer ? String(customer.id) : ''
    });
  }

  for (const work of pendingWorks) {
    if (work.status !== 'pending') continue;
    const zone = zoneNamedInText(work.note) || zoneNamedInText(work.source);
    addItem(zone, {
      type: 'work',
      id: work.id,
      title: work.note,
      detail: work.source || '',
      customerId: ''
    });
  }

  for (const entry of pendingHardwareRecovery(customers)) {
    const customer = entry.customer;
    addItem(customerZone(customer), {
      type: 'recovery',
      id: String(customer.id ?? ''),
      title: [cleanText(customer.name), customer.customerNumber ? `#${customer.customerNumber}` : ''].filter(Boolean).join(' '),
      detail: entry.items.map((item) => item.label).join(', '),
      customerId: String(customer.id ?? '')
    });
  }

  const typeOrder = Object.fromEntries(DISPATCH_ITEM_TYPES.map((type, index) => [type, index]));
  const zones = [...groups.values()]
    .filter((group) => group.totalCount > 0)
    .map((group) => {
      const items = [...group.items].sort((a, b) => typeOrder[a.type] - typeOrder[b.type]);
      const built = { ...group, items };
      built.summary = buildZoneDispatchSummary(built);
      built.whatsappUrl = buildZoneDispatchUrl(built);
      return built;
    })
    .sort((a, b) => {
      if (a.key === UNASSIGNED_ZONE_KEY) return 1;
      if (b.key === UNASSIGNED_ZONE_KEY) return -1;
      return (b.totalCount - a.totalCount) || a.label.localeCompare(b.label);
    });

  const counts = emptyCounts();
  let totalOpen = 0;
  for (const zone of zones) {
    totalOpen += zone.totalCount;
    for (const type of DISPATCH_ITEM_TYPES) counts[type] += zone.counts[type];
  }
  const unassigned = zones.find((zone) => zone.key === UNASSIGNED_ZONE_KEY);
  return { zones, totalOpen, counts, unassignedCount: unassigned ? unassigned.totalCount : 0 };
}

const TYPE_HEADINGS = {
  complaint: '⚠️ Complaints',
  ticket: '🎫 Tickets',
  installation: '🔌 New installations',
  work: '📝 Pending works',
  recovery: '📦 Hardware recovery'
};

/**
 * The deterministic WhatsApp worklist text for one zone group (as
 * returned by buildFieldDispatchBoard — items + counts + label).
 * Plain Roman Urdu, matching the house WhatsApp message style.
 */
export function buildZoneDispatchSummary(zone) {
  if (!zone || !Array.isArray(zone.items) || zone.items.length === 0) return '';
  const heading = zone.label || 'Area not set';
  const lines = [`🧰 *${heading} — Field worklist* (${zone.items.length})`];
  for (const type of DISPATCH_ITEM_TYPES) {
    const items = zone.items.filter((item) => item.type === type);
    if (items.length === 0) continue;
    lines.push('', `${TYPE_HEADINGS[type]} (${items.length}):`);
    for (const item of items) {
      const detail = item.detail ? ` — ${item.detail}` : '';
      const ref = item.id && type !== 'recovery' ? ` (${item.id})` : '';
      lines.push(`• ${item.title}${detail}${ref}`);
    }
  }
  lines.push('', 'Shahdara Fiber Net — please update status after visit.');
  return lines.join('\n');
}

/**
 * wa.me URL for a zone's dispatch summary. With a valid recipient
 * number the house formatWhatsAppUrl builds the direct chat link;
 * without one, the share-picker URL used by the shipped staff
 * summaries (the operator picks Saad in WhatsApp).
 */
export function buildZoneDispatchUrl(zone, phone = '') {
  const summary = zone && typeof zone.summary === 'string' && zone.summary
    ? zone.summary
    : buildZoneDispatchSummary(zone);
  if (!summary) return '';
  if (cleanText(phone)) {
    const res = formatWhatsAppUrl(phone, summary);
    if (res.validPhone && res.url) return res.url;
  }
  return `https://wa.me/?text=${encodeURIComponent(summary)}`;
}
