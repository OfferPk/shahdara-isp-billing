/**
 * commercial-sla.js — SISP-84: Commercial / Plaza VIP Connection SLA
 * Priority Tag (🏢 Commercial VIP).
 *
 * A customer profile carries connectionType: 'residential' (the default
 * for every existing record) or 'commercial_vip'. Commercial / plaza
 * connections pay for a response SLA, so any OPEN complaint (SISP-15
 * register) or OPEN field ticket (SISP-12) belonging to a commercial_vip
 * customer is treated as Urgent and pinned to the top of its queue with
 * a "< 2 Hours SLA" badge.
 *
 * Everything here is pure and derived live from the customer record:
 * upgrading a customer to commercial_vip immediately re-prioritizes
 * their already-open items, resolving an item removes its pin (a
 * resolved item is never reordered), and residential items always keep
 * their existing relative order. Nothing in this module mutates a
 * complaint, a ticket or a customer.
 *
 * The stored priority written at creation time comes from
 * priorityForNewQueueItem (a VIP customer's new complaint/ticket is
 * born 'Urgent'); effectiveQueuePriority then derives the display
 * priority so a customer upgraded AFTER logging still shows Urgent.
 * This module imports nothing: core.js sanitizes connectionType inline
 * (the serviceStatus pattern), and the two queue modules import these
 * helpers directly.
 */

export const CONNECTION_TYPE_RESIDENTIAL = 'residential';
export const CONNECTION_TYPE_COMMERCIAL_VIP = 'commercial_vip';
export const CONNECTION_TYPES = [CONNECTION_TYPE_RESIDENTIAL, CONNECTION_TYPE_COMMERCIAL_VIP];

/** The only valid stored values; anything else reads as 'residential'. */
export function normalizeConnectionType(value) {
  return value === CONNECTION_TYPE_COMMERCIAL_VIP ? CONNECTION_TYPE_COMMERCIAL_VIP : CONNECTION_TYPE_RESIDENTIAL;
}

/** True when the customer record is tagged commercial / plaza VIP. */
export function isCommercialVip(customer) {
  return !!customer && typeof customer === 'object'
    && normalizeConnectionType(customer.connectionType) === CONNECTION_TYPE_COMMERCIAL_VIP;
}

/**
 * Open means "still owed work" in both ledgers (SISP-15 + SISP-12 share
 * the Open / In Progress / Resolved status vocabulary). A Resolved item
 * is closed history: it is never pinned and never re-prioritized.
 */
export function isOpenQueueItem(item) {
  return !!item && typeof item === 'object' && typeof item.status === 'string' && item.status !== 'Resolved';
}

/**
 * Finds the customer for a queue item. `customers` may be an array of
 * customer records, a Map keyed by id, a plain object keyed by id, or a
 * lookup function (id) => customer. Unknown ids resolve to null, so
 * area-outage records (customerId AREA_OUTAGE) never pin.
 */
export function queueItemCustomer(customers, item) {
  const customerId = item && typeof item === 'object' ? item.customerId : null;
  if (customerId === null || customerId === undefined || customerId === '') return null;
  if (typeof customers === 'function') return customers(customerId) ?? null;
  if (customers instanceof Map) return customers.get(customerId) ?? customers.get(String(customerId)) ?? null;
  if (Array.isArray(customers)) {
    return customers.find((c) => c && String(c.id) === String(customerId)) ?? null;
  }
  if (customers && typeof customers === 'object') return customers[customerId] ?? null;
  return null;
}

/** True when this queue item must pin to the top: open + VIP customer. */
export function isSlaPinned(item, customers) {
  return isOpenQueueItem(item) && isCommercialVip(queueItemCustomer(customers, item));
}

/**
 * The priority a queue item is worked/displayed at: a pinned (open,
 * VIP) item is always 'Urgent'; any other item keeps its stored
 * priority when it is a known value, else 'Normal'.
 */
export function effectiveQueuePriority(item, customers) {
  if (isSlaPinned(item, customers)) return 'Urgent';
  return item && (item.priority === 'Urgent' || item.priority === 'Normal') ? item.priority : 'Normal';
}

/**
 * The stored priority for a newly logged complaint/ticket: a
 * commercial_vip customer's item is born 'Urgent' whatever the form
 * asked for; a residential item keeps the requested priority (default
 * 'Normal').
 */
export function priorityForNewQueueItem(customer, requestedPriority) {
  if (isCommercialVip(customer)) return 'Urgent';
  return requestedPriority === 'Urgent' ? 'Urgent' : 'Normal';
}

/**
 * Pure, stable queue ordering: SLA-pinned items (open + VIP) first, in
 * their existing relative order, then every other item in its existing
 * relative order — residential and resolved items are never reordered
 * among themselves. Returns a NEW array; the input is not mutated.
 * Callers apply their own base ordering first (register: newest
 * reported first; tickets: Open first, newest first) and this pass on
 * top, so a pinned item rises above older residential items without
 * disturbing anything else.
 */
export function sortQueueBySla(items, customers) {
  const rows = Array.isArray(items) ? items : [];
  const pinned = [];
  const rest = [];
  for (const item of rows) {
    (isSlaPinned(item, customers) ? pinned : rest).push(item);
  }
  return [...pinned, ...rest];
}
