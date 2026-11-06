// Household link note (Plan 356): one note joining two customer records
// by reference only (customer A, customer B, relationship in plain
// words, date noted). It merges no records, moves no dues, and changes
// no bill; each linked profile shows the other household member's name
// and relationship, and removing the link removes only the note.
//
// The module never reads storage, the clock, the network, or the page.
// Inputs are never mutated.

export const HOUSEHOLD_LINK_STORE_KEY = 'shahdara_hhl_links_v1';
export const HOUSEHOLD_LINK_RELATIONSHIP_MAX_LENGTH = 80;

const HOUSEHOLD_LINK_DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function cleanHouseholdLinkText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function cleanHouseholdLinkKey(value) {
  return cleanHouseholdLinkText(value).toLowerCase();
}

function isHouseholdLinkLeapYear(year) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

/** Strict YYYY-MM-DD validation against the real calendar (leap-aware). */
export function isStrictHouseholdLinkDate(value) {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12) return false;
  let limit = HOUSEHOLD_LINK_DAYS_IN_MONTH[month - 1];
  if (month === 2 && isHouseholdLinkLeapYear(year)) limit = 29;
  return day >= 1 && day <= limit;
}

function escapeHouseholdLinkHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

function householdLinkPairKey(customerA, customerB) {
  const a = cleanHouseholdLinkKey(customerA);
  const b = cleanHouseholdLinkKey(customerB);
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

export function normalizeHouseholdLink(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = cleanHouseholdLinkText(raw.id);
  const customerA = cleanHouseholdLinkText(raw.customerA);
  const customerB = cleanHouseholdLinkText(raw.customerB);
  const relationship = cleanHouseholdLinkText(raw.relationship)
    .slice(0, HOUSEHOLD_LINK_RELATIONSHIP_MAX_LENGTH);
  const dateNoted = cleanHouseholdLinkText(raw.dateNoted);
  if (!id || !customerA || !customerB) return null;
  if (cleanHouseholdLinkKey(customerA) === cleanHouseholdLinkKey(customerB)) return null;
  if (!relationship) return null;
  if (!isStrictHouseholdLinkDate(dateNoted)) return null;
  return { id, customerA, customerB, relationship, dateNoted };
}

export function normalizeHouseholdLinkList(list) {
  if (!Array.isArray(list)) return [];
  const seenIds = new Set();
  const seenPairs = new Set();
  const out = [];
  for (const raw of list) {
    const link = normalizeHouseholdLink(raw);
    if (!link) continue;
    const idKey = cleanHouseholdLinkKey(link.id);
    const pairKey = householdLinkPairKey(link.customerA, link.customerB);
    if (seenIds.has(idKey) || seenPairs.has(pairKey)) continue;
    seenIds.add(idKey);
    seenPairs.add(pairKey);
    out.push(link);
  }
  return out;
}

export function recordHouseholdLink(list, link) {
  const normalized = normalizeHouseholdLinkList(list);
  const fresh = normalizeHouseholdLink(link);
  if (!fresh) return normalized;
  const pairKey = householdLinkPairKey(fresh.customerA, fresh.customerB);
  if (normalized.some(existing => householdLinkPairKey(existing.customerA, existing.customerB) === pairKey)) return normalized;
  return [...normalized, fresh];
}

export function removeHouseholdLink(list, id) {
  const idKey = cleanHouseholdLinkKey(id);
  return normalizeHouseholdLinkList(list)
    .filter(link => cleanHouseholdLinkKey(link.id) !== idKey);
}

export function householdLinksForCustomer(list, customerId) {
  const key = cleanHouseholdLinkKey(customerId);
  if (!key) return [];
  return normalizeHouseholdLinkList(list).filter(link =>
    cleanHouseholdLinkKey(link.customerA) === key ||
    cleanHouseholdLinkKey(link.customerB) === key);
}

export function householdLinkOtherId(link, customerId) {
  if (!link || typeof link !== 'object') return '';
  const key = cleanHouseholdLinkKey(customerId);
  if (!key) return '';
  if (cleanHouseholdLinkKey(link.customerA) === key) return cleanHouseholdLinkText(link.customerB);
  if (cleanHouseholdLinkKey(link.customerB) === key) return cleanHouseholdLinkText(link.customerA);
  return '';
}

export function householdLinkCandidates(customers, customerId) {
  if (!Array.isArray(customers)) return [];
  const selfKey = cleanHouseholdLinkKey(customerId);
  const out = [];
  for (const customer of customers) {
    if (!customer || typeof customer !== 'object') continue;
    const id = cleanHouseholdLinkText(customer.id);
    if (!id || cleanHouseholdLinkKey(id) === selfKey) continue;
    if (customer.archived) continue;
    const name = cleanHouseholdLinkText(customer.name || customer.customerName);
    const mohalla = cleanHouseholdLinkText(customer.mohalla || customer.area) || 'Unassigned';
    out.push({ id, name, mohalla });
  }
  out.sort((a, b) => {
    const byName = cleanHouseholdLinkKey(a.name).localeCompare(cleanHouseholdLinkKey(b.name));
    if (byName !== 0) return byName;
    return cleanHouseholdLinkKey(a.id).localeCompare(cleanHouseholdLinkKey(b.id));
  });
  return out;
}

export function householdLinkRows(links, customerId, customers) {
  const mine = householdLinksForCustomer(links, customerId);
  const byId = new Map();
  if (Array.isArray(customers)) {
    for (const customer of customers) {
      if (customer && typeof customer === 'object' && customer.id && !customer.archived) {
        byId.set(cleanHouseholdLinkKey(customer.id), customer);
      }
    }
  }
  return mine.map(link => {
    const otherId = householdLinkOtherId(link, customerId);
    const other = byId.get(cleanHouseholdLinkKey(otherId));
    return {
      id: link.id,
      otherId,
      otherName: other ? cleanHouseholdLinkText(other.name || other.customerName) : '',
      otherMohalla: other ? (cleanHouseholdLinkText(other.mohalla || other.area) || 'Unassigned') : '',
      otherFound: Boolean(other),
      relationship: link.relationship,
      dateNoted: link.dateNoted,
    };
  });
}

export function householdLinkRowText(row) {
  if (!row || typeof row !== 'object') return '';
  const who = row.otherFound
    ? (cleanHouseholdLinkText(row.otherName) || 'Unnamed customer')
    : 'Customer record not found';
  return `${who} — ${cleanHouseholdLinkText(row.relationship)} — noted ${cleanHouseholdLinkText(row.dateNoted)}`;
}

export function householdLinkSummaryText(rows) {
  const list = Array.isArray(rows) ? rows : [];
  if (list.length === 0) return 'No household link yet.';
  if (list.length === 1) return '1 household link.';
  return `${list.length} household links.`;
}

export function householdLinkOptionsHtml(candidates) {
  const list = Array.isArray(candidates) ? candidates : [];
  const options = list.map(candidate =>
    `<option value="${escapeHouseholdLinkHtml(candidate.id)}">${escapeHouseholdLinkHtml(candidate.name || 'Unnamed customer')} — ${escapeHouseholdLinkHtml(candidate.mohalla)}</option>`).join('');
  return `<option value="" disabled selected>Choose another customer</option>${options}`;
}

export function householdLinkSectionHtml(customer, links, customers) {
  if (!customer || typeof customer !== 'object') return '';
  const rows = householdLinkRows(links, customer.id, customers);
  const candidates = householdLinkCandidates(customers, customer.id);
  const listHtml = rows.length
    ? `<ul class="hhl-list">${rows.map(row => {
      const who = row.otherFound
        ? `<button type="button" class="hhl-open" data-household-link-open="${escapeHouseholdLinkHtml(row.otherId)}">${escapeHouseholdLinkHtml(row.otherName || 'Unnamed customer')}</button>`
        : '<span class="hhl-name">Customer record not found</span>';
      return `<li>${who}<span class="hhl-relationship">${escapeHouseholdLinkHtml(row.relationship)}</span><span class="hhl-date">noted ${escapeHouseholdLinkHtml(row.dateNoted)}</span><button type="button" class="secondary-button hhl-remove" data-household-link-remove="${escapeHouseholdLinkHtml(row.id)}">Remove link</button></li>`;
    }).join('')}</ul>`
    : '<p class="hhl-none">No household link yet.</p>';
  const formHtml = candidates.length
    ? `<form class="hhl-form" id="hhlForm"><label for="hhlOther">Link with another customer<select id="hhlOther" required>${householdLinkOptionsHtml(candidates)}</select></label><label for="hhlRelationship">Relationship<input id="hhlRelationship" type="text" maxlength="80" placeholder="e.g. father and son" required></label><label for="hhlDate">Date noted<input id="hhlDate" type="date" required></label><button type="submit" class="primary-button" id="hhlSaveBtn">Add household link</button></form>`
    : '<p class="hhl-none">No other customer to link yet.</p>';
  return `<section class="profile-custody-section profile-household-link" aria-label="Household link"><h4>Household link</h4><p>Two records in one house — for example father and son, or house and shop — can be linked here so a payment for the household is noted against the other record. A link joins the two records by reference only: it merges nothing, moves no dues, and changes no bill.</p><p class="hhl-summary">${escapeHouseholdLinkHtml(householdLinkSummaryText(rows))}</p>${listHtml}${formHtml}</section>`;
}
