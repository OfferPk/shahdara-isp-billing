// Plan 201 (Plan 101-202) — Business contact directory.
//
// Supplier, service, and authority contacts live in phones and
// notebooks, so when the usual person is away nobody knows who else
// to call. This module is that directory: one entry per business
// contact, with its organisation as entered, contact name, role,
// phone or address as entered, and note.
//
// Scope fence, stated plainly:
//   - This stores business contacts only. It never stores customer
//     contacts, and it sends no message automatically.
//   - It is a directory only: recording a contact never changes any
//     bill, payment, vendor record, or customer record.
//   - It is NOT the customer contact modules: contact-preferences.js
//     and contact-cooldown-tracker.js are neither read nor written
//     here, and neither are vendor-bills.js or vendor-contracts.js.
//     This adds only the business-contacts piece.
//   - It is import-free: the caller supplies every contact and the
//     module never reads storage, the clock, or the network, and
//     never mutates an input.
//   - Unknown fields are dropped, so no bill, payment, vendor,
//     customer, or sending field can ever creep into a contact.

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function normalizeBusinessContact(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = cleanText(raw.id);
  const organisation = cleanText(raw.organisation);
  const contactName = cleanText(raw.contactName);
  if (!id || !organisation || !contactName) return null;
  return {
    id,
    organisation,
    contactName,
    role: cleanText(raw.role),
    phoneOrAddress: cleanText(raw.phoneOrAddress),
    note: cleanText(raw.note),
  };
}

export function normalizeBusinessContactList(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of list) {
    const contact = normalizeBusinessContact(raw);
    if (!contact || seen.has(contact.id)) continue;
    seen.add(contact.id);
    out.push(contact);
  }
  return out;
}

export function findBusinessContact(list, id) {
  const clean = cleanText(id);
  if (!clean) return null;
  return normalizeBusinessContactList(list).find((contact) => contact.id === clean) ?? null;
}

export function recordBusinessContact(list, contact) {
  const clean = normalizeBusinessContactList(list);
  const next = normalizeBusinessContact(contact);
  if (!next) return clean;
  if (clean.some((contact) => contact.id === next.id)) return clean;
  return [...clean, next];
}

export function removeBusinessContact(list, id) {
  const clean = cleanText(id);
  if (!clean) return normalizeBusinessContactList(list);
  return normalizeBusinessContactList(list).filter((contact) => contact.id !== clean);
}

export function businessContactsSorted(list) {
  return normalizeBusinessContactList(list).sort((a, b) => {
    const oa = a.organisation.toLowerCase();
    const ob = b.organisation.toLowerCase();
    if (oa !== ob) return oa < ob ? -1 : 1;
    const na = a.contactName.toLowerCase();
    const nb = b.contactName.toLowerCase();
    if (na !== nb) return na < nb ? -1 : 1;
    return a.id.localeCompare(b.id);
  });
}

export function businessContactsByOrganisation(list, organisation) {
  const want = cleanText(organisation).toLowerCase();
  if (!want) return businessContactsSorted(list);
  return businessContactsSorted(list).filter((contact) =>
    contact.organisation.toLowerCase().includes(want));
}

export function businessContactsByRole(list, role) {
  const want = cleanText(role).toLowerCase();
  if (!want) return businessContactsSorted(list);
  return businessContactsSorted(list).filter((contact) =>
    contact.role.toLowerCase().includes(want));
}

export function businessContactsBySearch(list, query) {
  const want = cleanText(query).toLowerCase();
  if (!want) return businessContactsSorted(list);
  return businessContactsSorted(list).filter((contact) =>
    contact.organisation.toLowerCase().includes(want) ||
    contact.contactName.toLowerCase().includes(want) ||
    contact.role.toLowerCase().includes(want));
}

export function businessContactSummaryText(list) {
  const clean = normalizeBusinessContactList(list);
  if (!clean.length) return 'No business contacts recorded.';
  const organisations = new Set(clean.map((contact) => contact.organisation.toLowerCase())).size;
  const orgWord = organisations === 1 ? 'organisation' : 'organisations';
  return `${clean.length} business ${clean.length === 1 ? 'contact' : 'contacts'} across ${organisations} ${orgWord}.`;
}

export function businessContactText(contact) {
  const clean = normalizeBusinessContact(contact);
  if (!clean) return '';
  const role = clean.role ? ` · ${clean.role}` : '';
  const reach = clean.phoneOrAddress ? ` · ${clean.phoneOrAddress}` : '';
  const note = clean.note ? ` — ${clean.note}` : ' — No note.';
  return `${clean.organisation} · ${clean.contactName}${role}${reach}${note}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export function businessContactHtml(contact) {
  const clean = normalizeBusinessContact(contact);
  if (!clean) return '';
  const role = clean.role ? ` · ${escapeHtml(clean.role)}` : '';
  const reach = clean.phoneOrAddress ? ` · ${escapeHtml(clean.phoneOrAddress)}` : '';
  const note = clean.note ? ` — ${escapeHtml(clean.note)}` : ' — No note.';
  return `<p>${escapeHtml(clean.organisation)} · ${escapeHtml(clean.contactName)}${role}${reach}${note}</p>`;
}

export function businessContactAllHtml(list) {
  return businessContactsSorted(list).map(businessContactHtml).join('');
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function businessContactCsv(list) {
  const rows = [['id', 'organisation', 'contact_name', 'role', 'phone_or_address', 'note']];
  for (const contact of businessContactsSorted(list)) {
    rows.push([contact.id, contact.organisation, contact.contactName, contact.role, contact.phoneOrAddress, contact.note]);
  }
  return rows.map((row) => row.map(csvCell).join(',')).join('\n');
}

export function businessContactFilename() {
  return 'business-contacts.csv';
}
