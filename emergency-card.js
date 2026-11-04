// Plan 54 (Plan 1-100) — Emergency contact and escalation card
// (offline, on-device).
//
// In a real outage the numbers that matter — upstream support, the
// electrician, the equipment supplier, the owner's second contact —
// live in someone's phone or memory, and the person on site may not
// be the person who holds them. This module is that written card:
// named contacts with a role, a phone number, and the situations
// each contact covers, plus a short ordered escalation note saying
// who to call first, then next.
//
// Scope fence, stated plainly:
//   - It is import-free: the caller supplies every contact, and the
//     module never reads storage, the clock, or the network, and
//     never mutates an input.
//   - It is a reference card only, not an auto-dialler and not an
//     auto-message: nothing here dials, texts, or sends anything.
//     Phone numbers render as plain text, never as a dial link, so
//     using the card is a deliberate act by the operator.
//   - Viewing or using the card never sends a message and never
//     alters any record. The module holds no customer, bill,
//     payment, or ticket field, and it never writes into any of
//     them. Editing a contact is the one write it performs, and
//     that edit is logged by the caller through Plan 31's audit
//     log (the 'emergency_contact_edited' action), not by this
//     module itself.
//   - A contact with no name, an unknown role, a phone number with
//     fewer than 7 digits, or no covered situation at all is
//     refused outright, never stored half-formed. A blank note
//     stays empty, never guessed.

export const EMERGENCY_ROLES = Object.freeze([
  { value: 'upstream_support', label: 'Upstream support' },
  { value: 'power_electrician', label: 'Power / electrician' },
  { value: 'equipment_supplier', label: 'Equipment supplier' },
  { value: 'owner', label: 'Owner' },
]);

const ROLE_LABELS = new Map(EMERGENCY_ROLES.map((r) => [r.value, r.label]));

const ROLE_ALIASES = Object.freeze({
  upstreamsupport: 'upstream_support',
  upstream: 'upstream_support',
  isp: 'upstream_support',
  provider: 'upstream_support',
  powerelectrician: 'power_electrician',
  electrician: 'power_electrician',
  power: 'power_electrician',
  electrical: 'power_electrician',
  equipmentsupplier: 'equipment_supplier',
  supplier: 'equipment_supplier',
  vendor: 'equipment_supplier',
  shop: 'equipment_supplier',
  owner: 'owner',
  secondcontact: 'owner',
  backupcontact: 'owner',
});

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function squashed(value) {
  return text(value).toLowerCase().replace(/[^a-z0-9]+/g, '');
}

export function normalizeEmergencyRole(value) {
  if (typeof value !== 'string') return null;
  const key = squashed(value);
  if (ROLE_LABELS.has(key)) return key;
  return ROLE_ALIASES[key] ?? null;
}

export function emergencyRoleLabel(role) {
  return ROLE_LABELS.get(role) ?? null;
}

// A phone number is kept exactly as typed (spaces, +, and dashes
// preserved for display) but must contain at least 7 digits and
// nothing but digits, +, spaces, dashes, or parentheses; anything
// else is refused, never silently repaired.
export function normalizeEmergencyPhone(value) {
  if (typeof value !== 'string') return null;
  const phone = text(value);
  if (!phone) return null;
  if (!/^[0-9+()\- ]+$/.test(phone)) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 7) return null;
  return phone;
}

function normalizeSituations(value) {
  const raw = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : [];
  const seen = new Set();
  const out = [];
  for (const item of raw) {
    const situation = text(item);
    if (!situation || !/[a-z0-9]/i.test(situation)) continue;
    const key = situation.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(situation);
  }
  return out;
}

export function normalizeEmergencyContact(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const id = text(entry.id);
  const name = text(entry.name);
  const role = normalizeEmergencyRole(entry.role);
  const phone = normalizeEmergencyPhone(entry.phone ?? entry.number);
  const situations = normalizeSituations(entry.situations ?? entry.coveredSituations);
  if (!id || !name || !role || !phone || !situations.length) return null;
  return {
    id,
    name,
    role,
    roleLabel: ROLE_LABELS.get(role),
    phone,
    situations,
    note: text(entry.note),
  };
}

export function normalizeEmergencyContacts(entries) {
  if (!Array.isArray(entries)) return [];
  const byId = new Map();
  for (const raw of entries) {
    const contact = normalizeEmergencyContact(raw);
    if (contact) byId.set(contact.id, contact);
  }
  return [...byId.values()];
}

export function findEmergencyContact(entries, id) {
  const list = normalizeEmergencyContacts(entries);
  return list.find((contact) => contact.id === text(id)) ?? null;
}

export function upsertEmergencyContact(entries, entry) {
  const list = normalizeEmergencyContacts(entries);
  const next = normalizeEmergencyContact(entry);
  if (!next) return list;
  const existing = list.findIndex((item) => item.id === next.id);
  if (existing >= 0) list[existing] = next;
  else list.push(next);
  return list;
}

export function removeEmergencyContact(entries, id) {
  const list = normalizeEmergencyContacts(entries).filter((contact) => contact.id !== text(id));
  return list;
}

// The card is the contacts plus the escalation order: an ordered
// list of contact ids (first to call first) and a short free-text
// note. Unknown ids are dropped and repeats collapsed, so the order
// can never point at a contact that is not on the card.
export function normalizeEscalationOrder(contacts, order) {
  const list = normalizeEmergencyContacts(contacts);
  const known = new Set(list.map((contact) => contact.id));
  const seen = new Set();
  const out = [];
  const raw = Array.isArray(order) ? order : [];
  for (const item of raw) {
    const id = text(item);
    if (!id || !known.has(id) || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

export function normalizeEmergencyCard(card) {
  if (!card || typeof card !== 'object') return { contacts: [], escalationOrder: [], escalationNote: '' };
  const contacts = normalizeEmergencyContacts(card.contacts);
  return {
    contacts,
    escalationOrder: normalizeEscalationOrder(contacts, card.escalationOrder ?? card.order),
    escalationNote: text(card.escalationNote ?? card.note),
  };
}

// The ordered escalation list: contacts named in the order first,
// in that order; contacts not named in the order follow, name A–Z,
// marked unlisted, so nobody on the card is ever hidden from it.
export function escalationList(card) {
  const normalized = normalizeEmergencyCard(card);
  const byId = new Map(normalized.contacts.map((contact) => [contact.id, contact]));
  const ordered = normalized.escalationOrder
    .map((id) => byId.get(id))
    .filter(Boolean)
    .map((contact, index) => ({ ...contact, position: index + 1, unlisted: false }));
  const orderedIds = new Set(normalized.escalationOrder);
  const rest = normalized.contacts
    .filter((contact) => !orderedIds.has(contact.id))
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
    .map((contact, index) => ({ ...contact, position: ordered.length + index + 1, unlisted: true }));
  return [...ordered, ...rest];
}

// Contacts whose covered situations name this situation
// (case-insensitive), in name order. A contact covering "all"
// covers every situation.
export function contactsForSituation(contacts, situation) {
  const wanted = text(situation).toLowerCase();
  if (!wanted) return [];
  return normalizeEmergencyContacts(contacts)
    .filter((contact) => contact.situations.some((item) => {
      const key = item.toLowerCase();
      return key === 'all' || key === wanted;
    }))
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}

export function emergencyCardSummaryText(card) {
  const normalized = normalizeEmergencyCard(card);
  const ordered = escalationList(normalized);
  const parts = [`${normalized.contacts.length} emergency contact${normalized.contacts.length === 1 ? '' : 's'}`];
  if (ordered.length) {
    parts.push(`call first: ${ordered[0].name} (${ordered[0].roleLabel})`);
  }
  if (normalized.escalationNote) parts.push(`note: ${normalized.escalationNote}`);
  return parts.join('. ') + '.';
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function csvCell(value) {
  const cell = String(value ?? '');
  return /[",\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell;
}

export function emergencyCardHtml(card) {
  const normalized = normalizeEmergencyCard(card);
  const ordered = escalationList(normalized);
  if (!ordered.length) return '<p>No emergency contacts yet.</p>';
  const rows = ordered.map((contact) => `<tr><td>${contact.position}</td><td>${escapeHtml(contact.name)}</td>`
    + `<td>${escapeHtml(contact.roleLabel)}</td><td>${escapeHtml(contact.phone)}</td>`
    + `<td>${escapeHtml(contact.situations.join(', '))}</td>`
    + `<td>${escapeHtml(contact.note || '—')}</td></tr>`).join('');
  const note = normalized.escalationNote
    ? `<p>Escalation note: ${escapeHtml(normalized.escalationNote)}</p>` : '';
  return note + '<table class="data-table"><thead><tr><th>#</th><th>Name</th><th>Role</th>'
    + '<th>Phone</th><th>Covers</th><th>Note</th></tr></thead>'
    + `<tbody>${rows}</tbody></table>`;
}

export function emergencyContactsCsv(card) {
  const normalized = normalizeEmergencyCard(card);
  const ordered = escalationList(normalized);
  const header = ['Order', 'Name', 'Role', 'Phone', 'Covers', 'Note'].map(csvCell).join(',');
  const rows = ordered.map((contact) => [
    contact.position, contact.name, contact.roleLabel, contact.phone,
    contact.situations.join('; '), contact.note,
  ].map(csvCell).join(','));
  return [header, ...rows].join('\n');
}

export function emergencyCardFilename(date) {
  const safe = typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : 'undated';
  return `emergency-contacts-${safe}.csv`;
}
