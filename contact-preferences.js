// Plan 15 (Plan 1-100) — Customer contact preferences (channel, language, opt-out).
//
// Reminders used to go to whatever number was on file, in whatever
// language the operator happened to write, so some customers got
// messages they could not read and others got messages they never
// asked for. This module writes those choices down, per customer:
// a preferred WhatsApp number (which may differ from the billing
// phone), a preferred message language (Urdu script or Roman Urdu),
// and a do-not-message flag with a reason.
//
// Scope fence, stated plainly: preferences affect ONLY drafts in
// Plans 11–14 (pre-due reminders, escalation ladder, payment
// confirmations, mohalla broadcast audience). They never touch a
// payment, a Waada promise, a balance, a bill, a collection rule, or
// a lifecycle rule — changing a preference changes no money and no
// record other than the preference itself, which lives in its own
// store apart from every payment and promise record.
//
// How the fence is kept in this module:
//   - It is import-free (like pre-due-reminders.js and
//     escalation-ladder.js): the caller supplies every customer and
//     every preference, and the module never reads storage, the
//     clock, or the network, and never mutates an input.
//   - A do-not-message customer is never drafted: apply functions
//     put them in a `skipped` list carrying the reason, so the
//     operator still sees WHO was skipped and WHY, instead of the
//     customer silently vanishing from a queue.
//   - A preferred number is used verbatim as typed; the module
//     invents no number and reformats nothing. Whether the number
//     is usable is decided at send time by the app's existing
//     formatWhatsAppUrl check, exactly as Plans 11–13 already do.
//   - An unset language (null) means "no preference": the caller
//     keeps its existing default (Roman Urdu drafts in Plans
//     11–13). An unknown language value is normalised to unset,
//     never coerced into a language the customer did not pick.
//   - For mohalla broadcasts (Plan 14) there is no per-customer
//     draft: one announcement text goes to a mohalla, and the
//     operator picks recipients manually from the WhatsApp draft.
//     So the broadcast helper only filters the audience: opted-out
//     customers are excluded from the audience and listed as
//     skipped with the reason, so the operator knows whom NOT to
//     add by hand. A broadcast draft is never split by language;
//     the operator picks one variant for the whole mohalla.

export const CONTACT_PREFERENCE_LANGUAGES = Object.freeze({
  ROMAN: 'roman',
  URDU: 'urdu',
});

export const CONTACT_PREFERENCE_NO_REASON = 'No reason recorded';

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isOptedOut(value) {
  return value === true || value === 'true' || value === 1;
}

// Queue rows carry customerId; customer records carry id. Both
// spellings mean the same customer, so lookups accept either.
function itemCustomerId(item) {
  return text(item?.customerId ?? item?.id);
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch]));
}

function csvCell(value) {
  const str = String(value ?? '');
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

// One normalised preference, or null when the row carries no
// customer to attach it to. A reason stored without the opt-out
// flag is cleared: a reason only means something while the flag
// is on, and keeping a stale reason would skip nobody yet imply
// a restriction that is not in force.
export function normalizeContactPreference(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const customerId = text(raw.customerId ?? raw.id);
  if (!customerId) return null;
  const doNotMessage = isOptedOut(raw.doNotMessage);
  const language = raw.language === CONTACT_PREFERENCE_LANGUAGES.URDU
    ? CONTACT_PREFERENCE_LANGUAGES.URDU
    : raw.language === CONTACT_PREFERENCE_LANGUAGES.ROMAN
      ? CONTACT_PREFERENCE_LANGUAGES.ROMAN
      : null;
  return {
    customerId,
    customerName: text(raw.customerName ?? raw.name),
    whatsappNumber: text(raw.whatsappNumber ?? raw.preferredNumber ?? raw.whatsappPhone),
    language,
    doNotMessage,
    doNotMessageReason: doNotMessage ? text(raw.doNotMessageReason ?? raw.reason) : '',
  };
}

export function normalizeContactPreferences(list) {
  const byCustomer = new Map();
  for (const raw of Array.isArray(list) ? list : []) {
    const pref = normalizeContactPreference(raw);
    if (pref) byCustomer.set(pref.customerId, pref);
  }
  return [...byCustomer.values()];
}

export function findContactPreference(list, customerId) {
  const id = text(customerId);
  if (!id || !Array.isArray(list)) return null;
  for (const raw of list) {
    const pref = normalizeContactPreference(raw);
    if (pref && pref.customerId === id) return pref;
  }
  return null;
}

// Insert or replace one customer's preference. Returns a NEW
// array; an invalid row leaves the list unchanged (as a copy).
export function upsertContactPreference(list, raw) {
  const current = normalizeContactPreferences(list);
  const pref = normalizeContactPreference(raw);
  if (!pref) return current;
  const index = current.findIndex((p) => p.customerId === pref.customerId);
  if (index >= 0) current[index] = pref;
  else current.push(pref);
  return current;
}

export function removeContactPreference(list, customerId) {
  const id = text(customerId);
  return normalizeContactPreferences(list).filter((p) => p.customerId !== id);
}

// Resolve one customer's send target: preferred number first,
// otherwise the number already on the customer record (WhatsApp
// number, then billing phone — the same order whatsappPhoneFor
// uses). Language is null when unset, so the caller keeps its
// default draft variant. Nothing here validates digits; the
// existing send-time check does that.
export function resolveContactRecipient({ customer, preference } = {}) {
  const pref = normalizeContactPreference(preference) ?? null;
  const customerId = text(customer?.id ?? customer?.customerId);
  const billingPhone = text(customer?.whatsappPhone) || text(customer?.phone);
  return {
    customerId,
    customerName: text(customer?.name ?? customer?.customerName) || (pref ? pref.customerName : ''),
    whatsappNumber: (pref && pref.whatsappNumber) || billingPhone,
    language: pref ? pref.language : null,
    doNotMessage: pref ? pref.doNotMessage : false,
    doNotMessageReason: pref ? pref.doNotMessageReason : '',
  };
}

// Apply preferences to one customer's draft, or null when the
// customer must not be messaged. The caller supplies the draft
// text builder; this function only decides number, language and
// skip — it never writes a draft itself, so Plans 11–13 keep
// their own draft wording untouched.
export function applyContactPreferenceToDraft(item, preferences) {
  const pref = findContactPreference(preferences, itemCustomerId(item));
  if (pref && pref.doNotMessage) return null;
  const recipient = resolveContactRecipient({ customer: item, preference: pref });
  return { ...recipient, variant: recipient.language ?? CONTACT_PREFERENCE_LANGUAGES.ROMAN };
}

// Apply preferences across a per-customer draft list (Plans
// 11–13 shape): each item carries customerId, customerName and
// billing fields, and buildDraft(item, variant) returns the draft
// text for that variant, or null when no draft may be made.
// Opted-out customers land in `skipped` with their reason (or the
// no-reason fallback, so a skipped row always explains itself);
// undraftable items are counted, never silently dropped from the
// counts. Inputs are never mutated.
export function applyContactPreferencesToDrafts({ items, preferences, buildDraft } = {}) {
  const counts = { total: 0, drafted: 0, skipped: 0, excludedUndraftable: 0 };
  const drafts = [];
  const skipped = [];
  for (const item of Array.isArray(items) ? items : []) {
    counts.total += 1;
    const pref = findContactPreference(preferences, itemCustomerId(item));
    if (pref && pref.doNotMessage) {
      counts.skipped += 1;
      skipped.push({
        customerId: pref.customerId,
        customerName: text(item?.customerName ?? item?.name) || pref.customerName || '—',
        reason: pref.doNotMessageReason || CONTACT_PREFERENCE_NO_REASON,
      });
      continue;
    }
    const recipient = resolveContactRecipient({ customer: item, preference: pref });
    const variant = recipient.language ?? CONTACT_PREFERENCE_LANGUAGES.ROMAN;
    const draftText = typeof buildDraft === 'function' ? buildDraft(item, variant) : null;
    if (!draftText) { counts.excludedUndraftable += 1; continue; }
    counts.drafted += 1;
    drafts.push({ ...recipient, variant, draftText });
  }
  return { drafts, skipped, counts };
}

// Broadcast audience (Plan 14 shape): customers are audience
// members, not draft rows. Opted-out customers are excluded from
// the audience and listed as skipped with the reason; everyone
// else keeps their resolved recipient (preferred number first)
// so the operator can see who is actually reachable.
export function applyContactPreferencesToAudience({ customers, preferences } = {}) {
  const audience = [];
  const skipped = [];
  for (const customer of Array.isArray(customers) ? customers : []) {
    const pref = findContactPreference(preferences, itemCustomerId(customer));
    if (pref && pref.doNotMessage) {
      skipped.push({
        customerId: pref.customerId,
        customerName: text(customer?.name ?? customer?.customerName) || pref.customerName || '—',
        reason: pref.doNotMessageReason || CONTACT_PREFERENCE_NO_REASON,
      });
      continue;
    }
    audience.push(resolveContactRecipient({ customer, preference: pref }));
  }
  return { audience, skipped };
}

export function contactPreferencesSummaryText(list) {
  const prefs = normalizeContactPreferences(list);
  if (prefs.length === 0) return 'No contact preferences saved yet.';
  const optedOut = prefs.filter((p) => p.doNotMessage).length;
  const withNumber = prefs.filter((p) => p.whatsappNumber).length;
  const withLanguage = prefs.filter((p) => p.language).length;
  return `${prefs.length} contact preference${prefs.length === 1 ? '' : 's'} saved`
    + ` (${withNumber} with a preferred number, ${withLanguage} with a preferred language, ${optedOut} do-not-message).`;
}

export function contactPreferenceHtml(list) {
  const prefs = normalizeContactPreferences(list);
  if (prefs.length === 0) return '<p class="empty-state">No contact preferences saved yet.</p>';
  const rows = prefs.map((p) => {
    const languageLabel = p.language === CONTACT_PREFERENCE_LANGUAGES.URDU
      ? 'Urdu script'
      : p.language === CONTACT_PREFERENCE_LANGUAGES.ROMAN ? 'Roman Urdu' : 'No preference';
    const name = escapeHtml(p.customerName || p.customerId);
    return `<tr><td><strong>${name}</strong><br><small>${escapeHtml(p.customerId)}</small></td>`
      + `<td>${p.whatsappNumber ? escapeHtml(p.whatsappNumber) : '<small>Uses number on file</small>'}</td>`
      + `<td>${languageLabel}</td>`
      + `<td>${p.doNotMessage
        ? `<strong>Do not message</strong><br><small>${escapeHtml(p.doNotMessageReason || CONTACT_PREFERENCE_NO_REASON)}</small>`
        : '<small>OK to message</small>'}</td></tr>`;
  }).join('');
  return `<table class="contact-preferences-table"><thead><tr><th>Customer</th><th>Preferred WhatsApp number</th><th>Preferred language</th><th>Messaging</th></tr></thead><tbody>${rows}</tbody></table>`;
}

export function contactPreferenceCsv(list) {
  const lines = ['Customer ID, Customer name, Preferred WhatsApp number, Preferred language, Do not message, Do not message reason'];
  for (const p of normalizeContactPreferences(list)) {
    lines.push([
      csvCell(p.customerId), csvCell(p.customerName), csvCell(p.whatsappNumber),
      csvCell(p.language ?? ''), p.doNotMessage ? 'yes' : 'no', csvCell(p.doNotMessageReason),
    ].join(','));
  }
  return lines.join('\n');
}
