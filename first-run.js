// Plan X — First-run and commercial presentation.
//
// PRESENTATION ONLY. This module never changes a record, a setting, a
// storage key, a backup, or any billing figure. It only describes what a
// new business still has to set up, what the empty-business state should
// say, and which installed-app shortcut lands where.
//
// NO DEMO CUSTOMERS. The app ships with an empty ledger (customer data
// lives only in this device's browser storage), so the empty state below
// never invents sample customers: no sample names, numbers, areas, or
// amounts appear anywhere in it. "No sample customers are included" is
// stated in the copy itself, so a fresh business can never mistake a
// demonstration row for a real customer.
//
// GUIDED PASS (reuses existing dialogs, adds none): a fresh business
// completes setup in one pass through the dialogs the app already has —
//   1. Business name — the account title in Digital Payments & QR
//      Settings (ships as the house default "Shahdara Fiber Net").
//   2. WhatsApp identity — the owner phone in the same settings dialog;
//      it is also the value the app mirrors to the
//      shahdara_owner_whatsapp_phone key on backup restore.
//   3. Receipt branding — the Receipt Footer Studio (footer text,
//      helpline, shops, Easypaisa/NayaPay numbers).
// Completion is DERIVED from those existing settings every time; no new
// storage key, no "setup done" flag, and no ledger field is introduced.
// A business is "fresh" only while it has zero customers AND neither
// the WhatsApp identity nor the receipt branding has been configured —
// so an existing business that simply never set a footer is never
// nagged by the first-run banner.
//
// MANIFEST ALIGNMENT: the installed-app shortcuts in manifest.webmanifest
// are pinned in MANIFEST_SHORTCUTS. manifestShortcutAlignment() checks a
// parsed manifest against them using the same hash rules nav-pwa.js
// parses (a leading "./" and "#/" are both just the route name;
// "easypaisa" is the Payments Inbox screen), so a shortcut that stops
// landing on the screen it names fails a test instead of failing
// silently on a customer's home screen.

export const DEFAULT_BUSINESS_NAME = 'Shahdara Fiber Net';

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch]));
}

function cleanText(value, max = 100) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

/** Business name for display: the owner's title, or the house default. */
export function sanitizeBusinessName(value) {
  const name = cleanText(value, 100);
  return name || DEFAULT_BUSINESS_NAME;
}

/**
 * Validate a Pakistani owner WhatsApp number. Accepts 03XXXXXXXXX,
 * +92 3XXXXXXXXX, and 92 3XXXXXXXXX (spaces/dashes ignored).
 * Returns { valid, normalized, reason } where normalized is the
 * 03XXXXXXXXX form, and reason is 'empty' | 'invalid' | null.
 */
export function validateOwnerPhone(value) {
  const raw = String(value ?? '').replace(/[\s-]/g, '');
  if (!raw) return { valid: false, normalized: '', reason: 'empty' };
  let digits = raw;
  if (digits.startsWith('+92')) digits = `0${digits.slice(3)}`;
  else if (digits.startsWith('92')) digits = `0${digits.slice(2)}`;
  if (/^03\d{9}$/.test(digits)) return { valid: true, normalized: digits, reason: null };
  return { valid: false, normalized: '', reason: 'invalid' };
}

const nonBlank = (value) => cleanText(value) !== '';

/**
 * The three guided-setup steps, derived from the settings the app
 * already stores. No step is ever marked done from a default alone
 * except the business name, which ships as the house brand.
 */
export function businessSetupChecklist(input = {}) {
  const { digitalSettings = {}, receiptFooter = {}, ownerWhatsappPhone = '' } =
    input && typeof input === 'object' ? input : {};
  const settings = digitalSettings && typeof digitalSettings === 'object' ? digitalSettings : {};
  const footer = receiptFooter && typeof receiptFooter === 'object' ? receiptFooter : {};
  const phone = validateOwnerPhone(settings.ownerPhone || ownerWhatsappPhone);
  const steps = [
    {
      key: 'business-name',
      label: 'Business name',
      done: nonBlank(settings.ownerAccountTitle),
      detail: sanitizeBusinessName(settings.ownerAccountTitle),
    },
    {
      key: 'whatsapp-identity',
      label: 'WhatsApp identity (owner phone)',
      done: phone.valid,
      detail: phone.valid ? phone.normalized : 'Not set yet',
    },
    {
      key: 'receipt-branding',
      label: 'Receipt branding (footer, helpline, shops)',
      done: nonBlank(footer.footerText) || nonBlank(footer.helplineWhatsapp)
        || nonBlank(footer.shopsText) || nonBlank(footer.easypaisaNumber)
        || nonBlank(footer.nayapayNumber),
      detail: 'Footer and helpline shown on every receipt',
    },
  ];
  const doneCount = steps.filter((step) => step.done).length;
  return { steps, doneCount, total: steps.length, complete: doneCount === steps.length };
}

/**
 * True only for a genuinely new business: zero customers and neither
 * the WhatsApp identity nor the receipt branding configured yet.
 * A business with customers, or one that configured either, is never
 * treated as first-run, however empty its ledger looks otherwise.
 */
export function isFreshBusiness({ customerCount = 0, digitalSettings = {}, receiptFooter = {}, ownerWhatsappPhone = '' } = {}) {
  // Exactly zero customers: negative, non-numeric, and positive counts
  // are all "not a fresh business", never a fresh one.
  if (Number(customerCount) !== 0) return false;
  const checklist = businessSetupChecklist({ digitalSettings, receiptFooter, ownerWhatsappPhone });
  const whatsapp = checklist.steps.find((step) => step.key === 'whatsapp-identity');
  const branding = checklist.steps.find((step) => step.key === 'receipt-branding');
  return !whatsapp.done && !branding.done;
}

/**
 * Clean empty-business state for a ledger with no customers. Carries
 * no customer data at all — no names, numbers, areas, or amounts —
 * and says so, so it can never be mistaken for test data.
 */
export function emptyBusinessHtml({ businessName = '', checklist = null } = {}) {
  const name = sanitizeBusinessName(businessName);
  const list = checklist && Array.isArray(checklist.steps)
    ? checklist.steps
    : businessSetupChecklist().steps;
  const done = list.filter((step) => step.done).length;
  const items = list.map((step) => `<li>${step.done ? '✓' : '○'} ${escapeHtml(step.label)} — ${escapeHtml(step.detail)}</li>`).join('');
  return `<section class="first-run-empty" aria-label="Getting started"><h3>Welcome to ${escapeHtml(name)}</h3>`
    + `<p>Your ledger is empty. No sample customers are included — every customer you see here will be one you added.</p>`
    + `<p>Business setup: ${done} of ${list.length} steps done.</p><ul>${items}</ul>`
    + `<div class="first-run-actions"><button type="button" data-first-run="digital-settings">Business setup</button> `
    + `<button type="button" data-first-run="receipt-footer">Receipt branding</button> `
    + `<button type="button" data-first-run="add-customer">Add first customer</button></div></section>`;
}

/** The first-run banner shown on Home for a fresh business. */
export function firstRunBannerHtml({ businessName = '', checklist = null } = {}) {
  const body = emptyBusinessHtml({ businessName, checklist });
  return `<section id="firstRunBannerContent" class="first-run-banner" aria-label="First-run business setup">${body}</section>`;
}

/**
 * The installed-app shortcuts, exactly as manifest.webmanifest declares
 * them: name, manifest URL, the nav-pwa action that URL must trigger,
 * and the screen it must land on.
 */
export const MANIFEST_SHORTCUTS = [
  { name: 'Quick Collect (2 Taps)', url: './#quick-collect', action: 'quick-collect', screen: 'Quick Collect' },
  { name: 'Add Customer', url: './#add-customer', action: 'add-customer', screen: 'Add Customer' },
  { name: "Today's Dues & Overdue", url: './#today-dues', action: 'today-dues', screen: "Today's Dues" },
  { name: 'Payments Inbox', url: './#/easypaisa', action: 'payments-inbox', screen: 'Payments Inbox' },
];

/** Resolve a manifest shortcut URL to its nav-pwa action (mirrors nav-pwa.js). */
export function shortcutActionFromUrl(url = '') {
  const raw = String(url || '').replace(/^\.\//, '').replace(/^#\/?/, '').trim().toLowerCase();
  if (raw === 'dues') return 'today-dues';
  if (raw === 'easypaisa') return 'payments-inbox';
  if (['quick-collect', 'add-customer', 'today-dues', 'payments-inbox'].includes(raw)) return raw;
  return null;
}

/**
 * Check a parsed manifest against MANIFEST_SHORTCUTS. Each entry reports
 * whether the shortcut is present, whether its URL matches the manifest
 * exactly, and whether that URL resolves to the action it promises.
 */
export function manifestShortcutAlignment(manifest = {}) {
  const declared = Array.isArray(manifest.shortcuts) ? manifest.shortcuts : [];
  return MANIFEST_SHORTCUTS.map((expected) => {
    const found = declared.find((entry) => entry && entry.url === expected.url)
      || declared.find((entry) => entry && entry.name === expected.name)
      || null;
    return {
      name: expected.name,
      url: expected.url,
      action: expected.action,
      screen: expected.screen,
      inManifest: Boolean(found),
      urlMatches: Boolean(found && found.url === expected.url),
      resolvesToAction: shortcutActionFromUrl(expected.url) === expected.action,
    };
  });
}
