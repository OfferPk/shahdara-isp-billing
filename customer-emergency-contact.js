// Customer emergency contact (Plan 368): one second person to call
// per customer, shown on the profile only — name, relationship in plain
// words, and phone number — for the times the account holder cannot be
// reached and Saad still needs to reach the household through a named
// family member instead of leaving the collection for another day. It
// is a contact record only: it changes no billing contact, and adding
// it never changes any bill, payment, or other customer record. It
// appears on the profile and nowhere else; a profile without one shows
// nothing extra.
//
// This is not the shop's outage contact card (Plan 54), which holds
// the upstream, electrician, and supplier numbers for a fault, and it
// is not the tenancy guarantor fields (SISP-143), which ride the
// customer record for a deposit. It is not the message contact
// preferences (Plan 15), which choose a WhatsApp number and language,
// and it is not the vehicle fault kit checklist (Plan 242), the
// printable NOC runbook card (SISP-160), or the business contact
// directory (Plan 201), which never stores customer contacts. The
// emergency contact is the missing piece: one named family member per
// customer, with a number to call.
//
// The module never reads storage, the clock, the network, or the page.
// Inputs are never mutated.

export const CUSTOMER_EMERGENCY_CONTACT_STORE_KEY = 'shahdara_emc_contacts_v1';
export const CUSTOMER_EMERGENCY_CONTACT_NAME_MAX_LENGTH = 60;
export const CUSTOMER_EMERGENCY_CONTACT_RELATIONSHIP_MAX_LENGTH = 60;
export const CUSTOMER_EMERGENCY_CONTACT_PHONE_MAX_LENGTH = 40;

function cleanCustomerEmergencyContactText(value) {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
}

function cleanCustomerEmergencyContactKey(value) {
  return cleanCustomerEmergencyContactText(value).toLowerCase();
}

function escapeCustomerEmergencyContactHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

export function normalizeCustomerEmergencyContact(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = cleanCustomerEmergencyContactText(raw.id);
  const customerId = cleanCustomerEmergencyContactText(raw.customerId);
  const name = cleanCustomerEmergencyContactText(raw.name).slice(0, CUSTOMER_EMERGENCY_CONTACT_NAME_MAX_LENGTH);
  const relationship = cleanCustomerEmergencyContactText(raw.relationship).slice(0, CUSTOMER_EMERGENCY_CONTACT_RELATIONSHIP_MAX_LENGTH);
  const phone = cleanCustomerEmergencyContactText(raw.phone).slice(0, CUSTOMER_EMERGENCY_CONTACT_PHONE_MAX_LENGTH);
  if (!id || !customerId) return null;
  if (!name) return null;
  if (!phone) return null;
  return { id, customerId, name, relationship, phone };
}

export function normalizeCustomerEmergencyContactList(list) {
  if (!Array.isArray(list)) return [];
  const seenIds = new Set();
  const seenCustomers = new Set();
  const out = [];
  for (const raw of list) {
    const contact = normalizeCustomerEmergencyContact(raw);
    if (!contact) continue;
    const idKey = cleanCustomerEmergencyContactKey(contact.id);
    const customerKey = cleanCustomerEmergencyContactKey(contact.customerId);
    if (seenIds.has(idKey)) continue;
    if (seenCustomers.has(customerKey)) continue;
    seenIds.add(idKey);
    seenCustomers.add(customerKey);
    out.push(contact);
  }
  return out;
}

/** Read the contact list from a storage-like object (or [] when unreadable). */
export function loadCustomerEmergencyContactList(storage) {
  try {
    const raw = storage?.getItem?.(CUSTOMER_EMERGENCY_CONTACT_STORE_KEY);
    return normalizeCustomerEmergencyContactList(raw ? JSON.parse(raw) : []);
  } catch {
    return [];
  }
}

/**
 * Record (or replace) the emergency contact for one customer. One
 * contact per customer: recording a new contact for a customer who
 * already has one replaces that contact in place. Returns the list
 * unchanged when the contact is invalid (no id, no customer, no name,
 * or no phone).
 */
export function recordCustomerEmergencyContact(list, contact) {
  const normalized = normalizeCustomerEmergencyContactList(list);
  const fresh = normalizeCustomerEmergencyContact(contact);
  if (!fresh) return normalized;
  const customerKey = cleanCustomerEmergencyContactKey(fresh.customerId);
  let replaced = false;
  const out = normalized.map(existing => {
    if (cleanCustomerEmergencyContactKey(existing.customerId) !== customerKey) return existing;
    replaced = true;
    return fresh;
  });
  return replaced ? out : [...normalized, fresh];
}

/** Remove the emergency contact for one customer; nothing else changes. */
export function removeCustomerEmergencyContact(list, customerId) {
  const normalized = normalizeCustomerEmergencyContactList(list);
  const customerKey = cleanCustomerEmergencyContactKey(customerId);
  if (!customerKey) return normalized;
  return normalized.filter(contact => cleanCustomerEmergencyContactKey(contact.customerId) !== customerKey);
}

export function customerEmergencyContactForCustomer(list, customerId) {
  const key = cleanCustomerEmergencyContactKey(customerId);
  if (!key) return null;
  return normalizeCustomerEmergencyContactList(list).find(contact => cleanCustomerEmergencyContactKey(contact.customerId) === key) ?? null;
}

export function hasCustomerEmergencyContact(list, customerId) {
  return customerEmergencyContactForCustomer(list, customerId) !== null;
}

export function customerEmergencyContactSummaryText(list) {
  const count = normalizeCustomerEmergencyContactList(list).length;
  if (count === 0) return 'No emergency contact noted.';
  if (count === 1) return '1 customer has an emergency contact noted.';
  return `${count} customers have an emergency contact noted.`;
}

export function customerEmergencyContactSectionHtml(customer, list, labels = {}) {
  if (!customer || typeof customer !== 'object') return '';
  const contact = customerEmergencyContactForCustomer(list, customer.id);
  const heading = cleanCustomerEmergencyContactText(labels.heading) || 'Emergency contact';
  const nameLabel = cleanCustomerEmergencyContactText(labels.nameLabel) || 'Name';
  const relationshipLabel = cleanCustomerEmergencyContactText(labels.relationshipLabel) || 'Relationship';
  const phoneLabel = cleanCustomerEmergencyContactText(labels.phoneLabel) || 'Phone number';
  const namePlaceholder = cleanCustomerEmergencyContactText(labels.namePlaceholder) || 'Full name';
  const relationshipPlaceholder = cleanCustomerEmergencyContactText(labels.relationshipPlaceholder) || 'e.g. Brother, wife, father';
  const phonePlaceholder = cleanCustomerEmergencyContactText(labels.phonePlaceholder) || 'e.g. 03012345678';
  const saveLabel = cleanCustomerEmergencyContactText(labels.save) || 'Save';
  const removeLabel = cleanCustomerEmergencyContactText(labels.remove) || 'Remove';
  const noneText = cleanCustomerEmergencyContactText(labels.none) || 'No emergency contact noted for this customer.';
  const currentHtml = contact
    ? `<p class="emc-current"><strong>${escapeCustomerEmergencyContactHtml(contact.name)}</strong>${contact.relationship ? ` — ${escapeCustomerEmergencyContactHtml(contact.relationship)}` : ''}<span class="emc-meta"> · ${escapeCustomerEmergencyContactHtml(contact.phone)}</span></p>`
    : `<p class="emc-none">${escapeCustomerEmergencyContactHtml(noneText)}</p>`;
  const formHtml = `<form class="emc-form" id="emcForm"><label for="emcName">${escapeCustomerEmergencyContactHtml(nameLabel)}<input id="emcName" type="text" maxlength="60" placeholder="${escapeCustomerEmergencyContactHtml(namePlaceholder)}" value="${contact ? escapeCustomerEmergencyContactHtml(contact.name) : ''}" required></label><label for="emcRelationship">${escapeCustomerEmergencyContactHtml(relationshipLabel)}<input id="emcRelationship" type="text" maxlength="60" placeholder="${escapeCustomerEmergencyContactHtml(relationshipPlaceholder)}" value="${contact ? escapeCustomerEmergencyContactHtml(contact.relationship) : ''}"></label><label for="emcPhone">${escapeCustomerEmergencyContactHtml(phoneLabel)}<input id="emcPhone" type="tel" maxlength="40" placeholder="${escapeCustomerEmergencyContactHtml(phonePlaceholder)}" value="${contact ? escapeCustomerEmergencyContactHtml(contact.phone) : ''}" required></label><button type="submit" class="primary-button" id="emcSaveBtn">${escapeCustomerEmergencyContactHtml(saveLabel)}</button>${contact ? `<button type="button" class="secondary-button" id="emcRemoveBtn">${escapeCustomerEmergencyContactHtml(removeLabel)}</button>` : ''}</form>`;
  return `<section class="profile-custody-section profile-customer-emergency-contact" aria-label="${escapeCustomerEmergencyContactHtml(heading)}"><h4>${escapeCustomerEmergencyContactHtml(heading)}</h4><p>When the account holder is away, Saad can still reach the household through a named family member instead of leaving the collection for another day. This note changes nothing by itself.</p>${currentHtml}${formHtml}</section>`;
}
