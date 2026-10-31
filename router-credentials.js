// SISP-94: Customer Router Wi-Fi SSID / Password & Remote Admin Port Vault.
//
// The ISP sets these credentials on the customer's own router at install
// time, so they are operational records of the ISP itself, kept in the
// owner's local-first ledger under the same trust model as the rest of
// the profile (the SISP-13 PPPoE fields are the direct precedent). The
// four fields — wifiSsid, wifiPassword, routerAdminPort,
// routerAdminPassword — are OPTIONAL and absent-by-default on the
// customer record; core.js validates them on save (addCustomer /
// updateCustomerProfile) and they travel in JSON backups like every
// other profile field.
//
// Presentation rules (pinned by tests):
// - Passwords are MASKED by default with a fixed-length mask (the mask
//   never leaks the real length) and appear in the section markup ONLY
//   when the caller explicitly asks for the revealed state (the profile
//   eye-toggle). Copy is likewise an explicit tap handled by app.js from
//   state — the secret is never stamped into a data attribute.
// - The vault renders ONLY on the customer profile: nothing here feeds
//   a list, search surface, receipt, print view or analytics.
// - "Send Wi-Fi Details on WhatsApp" follows the house wa.me DRAFT
//   pattern (profile-ui.js): it builds a prefilled link the owner
//   reviews and sends himself; this module never sends anything.
//
// Pure functions only — this module never reads or writes the ledger.

import { contactActionTargets } from './profile-ui.js';
import { t } from './nav-language.js';
import { helpButtonMarkup } from './help-guide.js?v=1.11.0';

/** Fixed-length mask: identical for every stored secret, any length. */
export const ROUTER_CREDENTIAL_MASK = '••••••••';

const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch]));
const safeField = (value, limit) => String(value ?? '').replace(/[\r\n\u2028\u2029]+/g, ' ').trim().slice(0, limit);

/** A stored admin port is only meaningful as an integer in 1..65535. */
export function normalizeRouterAdminPort(value) {
  if (value === '' || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isInteger(number) && number >= 1 && number <= 65535 ? number : null;
}

/**
 * Normalized read view of the four vault fields on a customer record.
 * Defensive against legacy/hand-edited records: strings are flattened
 * and trimmed, an out-of-range port reads back as null (not recorded).
 */
export function routerCredentialsOf(customer) {
  const wifiSsid = safeField(customer?.wifiSsid, 64);
  const wifiPassword = safeField(customer?.wifiPassword, 100);
  const routerAdminPort = normalizeRouterAdminPort(customer?.routerAdminPort);
  const routerAdminPassword = safeField(customer?.routerAdminPassword, 100);
  return {
    wifiSsid,
    wifiPassword,
    routerAdminPort,
    routerAdminPassword,
    hasWifiPassword: wifiPassword !== '',
    hasAdminPassword: routerAdminPassword !== '',
    hasWifiDetails: wifiSsid !== '' || wifiPassword !== '',
    hasAny: wifiSsid !== '' || wifiPassword !== '' || routerAdminPort !== null || routerAdminPassword !== ''
  };
}

/** Masked display for a stored secret: the fixed mask, or '' when unset. */
export function maskSecret(value) {
  return String(value ?? '').trim() ? ROUTER_CREDENTIAL_MASK : '';
}

function secretRowMarkup({ labelKey, valueKey, secret, revealed }) {
  const label = t(labelKey);
  if (!secret) {
    return `<p class="router-cred-row"><span>${escapeHtml(label)}</span> <strong>${escapeHtml(t('prof_not_set'))}</strong></p>`;
  }
  const shown = revealed ? secret : maskSecret(secret);
  const toggleLabel = revealed ? t('rcred_hide') : t('rcred_show');
  return `<p class="router-cred-row"><span>${escapeHtml(label)}</span> <strong class="router-cred-value" data-rcred-value="${valueKey}">${escapeHtml(shown)}</strong> <button type="button" class="secondary-button" data-rcred-toggle="${valueKey}" aria-pressed="${revealed ? 'true' : 'false'}">${escapeHtml(toggleLabel)}</button> <button type="button" class="secondary-button" data-rcred-copy="${valueKey}">${escapeHtml(t('rcred_copy'))}</button></p>`;
}

/**
 * Profile vault section markup. Passwords are masked unless the caller
 * passes the matching reveal flag (the profile eye-toggle state lives in
 * app.js and re-renders this section) — with both flags false the secret
 * strings appear NOWHERE in the returned HTML.
 *
 * The WhatsApp action mirrors resolveReceiptWhatsAppAction: when Wi-Fi
 * details exist but no usable mobile is on record, an explanatory note
 * renders instead of the button; when no Wi-Fi details exist at all,
 * neither renders (the vault's empty state already says what to do).
 */
export function routerCredentialsSectionHtml(customer, { revealWifi = false, revealAdmin = false } = {}) {
  const creds = routerCredentialsOf(customer);
  const action = resolveWifiWhatsAppAction(customer);
  const ssidRow = `<p class="router-cred-row"><span>${escapeHtml(t('rcred_ssid'))}</span> <strong>${creds.wifiSsid ? escapeHtml(creds.wifiSsid) : escapeHtml(t('prof_not_set'))}</strong></p>`;
  const wifiRow = secretRowMarkup({ labelKey: 'rcred_wifi_password', valueKey: 'wifi', secret: creds.wifiPassword, revealed: revealWifi === true });
  const portRow = `<p class="router-cred-row"><span>${escapeHtml(t('rcred_admin_port'))}</span> <strong>${creds.routerAdminPort !== null ? escapeHtml(String(creds.routerAdminPort)) : escapeHtml(t('prof_not_set'))}</strong></p>`;
  const adminRow = secretRowMarkup({ labelKey: 'rcred_admin_password', valueKey: 'admin', secret: creds.routerAdminPassword, revealed: revealAdmin === true });
  const whatsapp = action.type === 'draft'
    ? `<div class="router-cred-actions"><button type="button" class="primary-button" id="profileWifiWhatsappBtn">${escapeHtml(t('rcred_wa_btn'))}</button></div>`
    : action.type === 'phone-required'
      ? `<p class="profile-router-cred-note">${escapeHtml(t('rcred_wa_no_phone'))}</p>`
      : '';
  return `<section class="profile-router-cred-section" aria-label="${escapeHtml(t('rcred_aria'))}"><h4>${escapeHtml(t('rcred_heading'))} ${helpButtonMarkup('router_vault')}</h4><p class="profile-router-cred-note">${escapeHtml(t('rcred_note'))}</p>${ssidRow}${wifiRow}${portRow}${adminRow}${whatsapp}</section>`;
}

/**
 * Build the user-reviewed wa.me draft carrying the Wi-Fi name + password
 * to the customer's own recorded mobile; never sends. Returns null when
 * there is nothing to send (no SSID and no password) or no usable
 * WhatsApp target for the recorded phone.
 */
export function buildWifiDetailsWhatsAppDraft(customer) {
  const creds = routerCredentialsOf(customer);
  if (!creds.hasWifiDetails) return null;
  const target = contactActionTargets(customer?.phone)?.whatsapp;
  if (!target) return null;
  const lines = [t('rcred_wa_intro')];
  if (creds.wifiSsid) lines.push(t('rcred_wa_ssid', null, { ssid: creds.wifiSsid }));
  if (creds.wifiPassword) lines.push(t('rcred_wa_password', null, { password: creds.wifiPassword }));
  const message = lines.join('\n');
  return { url: `${target}?text=${encodeURIComponent(message)}`, message };
}

/** Resolve the profile WhatsApp button state for one customer. */
export function resolveWifiWhatsAppAction(customer) {
  const creds = routerCredentialsOf(customer);
  if (!creds.hasWifiDetails) return { type: 'unavailable', reason: 'no-details' };
  const phone = String(customer?.phone ?? '').trim();
  if (!contactActionTargets(phone)?.whatsapp) return { type: 'phone-required', hasSavedPhone: Boolean(phone) };
  const draft = buildWifiDetailsWhatsAppDraft(customer);
  return draft ? { type: 'draft', draft } : { type: 'unavailable', reason: 'invalid-phone' };
}
