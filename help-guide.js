/**
 * help-guide.js — OWNER-HELP: per-feature ℹ️ guide popups.
 *
 * Owner request (ALEX, voice note 2026-10-31): the app has many features
 * whose purpose is not obvious to a new user — the advanced ones most of
 * all (how an optical/Rx reading works, what a dry run is for, …). Every
 * feature therefore carries a small ℹ️ button; tapping it opens ONE
 * shared popup with a short 2–3 line guide: what the feature is for and
 * how it works, in the app's current language (English / اردو).
 *
 * Design (house patterns only):
 * - HELP_TOPICS is the single registry: topic key -> the nav-language.js
 *   dictionary keys for its title and body. Content lives in the
 *   TRANSLATIONS dictionaries (help_<topic>_title / help_<topic>_body),
 *   never as literals here, so both languages are audited the same way
 *   every other string in the app is.
 * - The popup is ONE static <dialog id="helpGuideDialog"> in index.html,
 *   class "billing-modal" (the shared shell whose surface is
 *   var(--modal-surface)) with the unified red-circle ↩ close button
 *   (class="close-btn", PR #453 / SISP-87 conforming).
 * - Wiring is ONE delegated document click handler: any element with
 *   data-help="<topic>" opens the popup for that topic. Feature code
 *   only renders the button; it never wires its own listener.
 * - This module reads and writes NO ledger data. It imports only
 *   nav-language.js (no cycle risk: nav-language imports nothing here).
 */

import { t } from './nav-language.js';

export const HELP_DIALOG_ID = 'helpGuideDialog';
export const HELP_TITLE_ID = 'helpGuideTitle';
export const HELP_BODY_ID = 'helpGuideBody';
export const HELP_CLOSE_ID = 'helpGuideCloseBtn';

/**
 * The topic registry. Keys are the values used in data-help="…"
 * attributes across index.html and the JS renderers. Every entry's
 * title/body keys MUST exist in BOTH the en and ur dictionaries —
 * tests/help-guide.test.js pins that, plus the reverse direction
 * (no registry entry without a mount, no mount without an entry).
 */
export const HELP_TOPICS = Object.freeze({
  field_mode: { titleKey: 'help_field_mode_title', bodyKey: 'help_field_mode_body' },
  optical_rx: { titleKey: 'help_optical_rx_title', bodyKey: 'help_optical_rx_body' },
  signal_area: { titleKey: 'help_signal_area_title', bodyKey: 'help_signal_area_body' },
  splitter_map: { titleKey: 'help_splitter_map_title', bodyKey: 'help_splitter_map_body' },
  splitter_sim: { titleKey: 'help_splitter_sim_title', bodyKey: 'help_splitter_sim_body' },
  gps_pins: { titleKey: 'help_gps_pins_title', bodyKey: 'help_gps_pins_body' },
  dry_run: { titleKey: 'help_dry_run_title', bodyKey: 'help_dry_run_body' },
  commission: { titleKey: 'help_commission_title', bodyKey: 'help_commission_body' },
  router_vault: { titleKey: 'help_router_vault_title', bodyKey: 'help_router_vault_body' },
  footer_studio: { titleKey: 'help_footer_studio_title', bodyKey: 'help_footer_studio_body' },
  feeder_host: { titleKey: 'help_feeder_host_title', bodyKey: 'help_feeder_host_body' },
  waada: { titleKey: 'help_waada_title', bodyKey: 'help_waada_body' },
  waada_score: { titleKey: 'help_waada_score_title', bodyKey: 'help_waada_score_body' },
  group_billing: { titleKey: 'help_group_billing_title', bodyKey: 'help_group_billing_body' },
  suspense: { titleKey: 'help_suspense_title', bodyKey: 'help_suspense_body' },
  daily_closing: { titleKey: 'help_daily_closing_title', bodyKey: 'help_daily_closing_body' },
  owner_khata: { titleKey: 'help_owner_khata_title', bodyKey: 'help_owner_khata_body' },
  khata_doctor: { titleKey: 'help_khata_doctor_title', bodyKey: 'help_khata_doctor_body' },
  mikrotik: { titleKey: 'help_mikrotik_title', bodyKey: 'help_mikrotik_body' },
  qr_scanner: { titleKey: 'help_qr_scanner_title', bodyKey: 'help_qr_scanner_body' },
  bad_debt: { titleKey: 'help_bad_debt_title', bodyKey: 'help_bad_debt_body' },
  prepay: { titleKey: 'help_prepay_title', bodyKey: 'help_prepay_body' },
  kist: { titleKey: 'help_kist_title', bodyKey: 'help_kist_body' },
  complaints: { titleKey: 'help_complaints_title', bodyKey: 'help_complaints_body' },
  uptime: { titleKey: 'help_uptime_title', bodyKey: 'help_uptime_body' },
  revenue_leak: { titleKey: 'help_revenue_leak_title', bodyKey: 'help_revenue_leak_body' },
  loyalty: { titleKey: 'help_loyalty_title', bodyKey: 'help_loyalty_body' },
  additional_pending: { titleKey: 'help_additional_pending_title', bodyKey: 'help_additional_pending_body' },
});

/** All registered topic keys, in registry order. */
export const HELP_TOPIC_KEYS = Object.freeze(Object.keys(HELP_TOPICS));

/**
 * The shared ℹ️ button markup for JS renderers (profile sections).
 * Static mounts in index.html write the same markup by hand.
 * The button is deliberately NOT a close control: no close class, no
 * data-close, no "close" in its id or aria-label (SISP-87 audit).
 */
export function helpButtonMarkup(topicKey) {
  return `<button class="help-info-btn" type="button" data-help="${topicKey}" aria-label="${t('help_aria_label')}">ℹ️</button>`;
}

/**
 * Resolve a topic to its display strings in the requested (or active)
 * language. Returns null for an unknown topic — an unregistered
 * data-help value is a wiring bug the tests pin, never a popup with a
 * raw dictionary key in it.
 */
export function helpTopicContent(topicKey, lang = null) {
  const topic = HELP_TOPICS[topicKey];
  if (!topic) return null;
  return { title: t(topic.titleKey, lang), body: t(topic.bodyKey, lang) };
}

function resolveDocument(doc) {
  if (doc) return doc;
  return typeof document !== 'undefined' ? document : null;
}

/**
 * Open the shared guide popup for a topic. Returns true when the popup
 * was shown, false for an unknown topic or a missing dialog (never
 * throws — a help button must never break the screen it sits on).
 */
export function openHelpTopic(topicKey, doc = null) {
  const content = helpTopicContent(topicKey);
  const root = resolveDocument(doc);
  if (!content || !root || typeof root.getElementById !== 'function') return false;
  const dialog = root.getElementById(HELP_DIALOG_ID);
  if (!dialog) return false;
  const titleEl = root.getElementById(HELP_TITLE_ID);
  const bodyEl = root.getElementById(HELP_BODY_ID);
  if (titleEl) titleEl.textContent = content.title;
  if (bodyEl) bodyEl.textContent = content.body;
  if (typeof dialog.showModal === 'function') {
    if (!dialog.open) dialog.showModal();
  } else {
    dialog.hidden = false;
  }
  return true;
}

/** Close the shared guide popup (no-op when it is not open). */
export function closeHelpGuide(doc = null) {
  const root = resolveDocument(doc);
  if (!root || typeof root.getElementById !== 'function') return false;
  const dialog = root.getElementById(HELP_DIALOG_ID);
  if (!dialog) return false;
  if (typeof dialog.close === 'function') dialog.close();
  else dialog.hidden = true;
  return true;
}

let helpGuidesWired = false;

/**
 * Register the ONE delegated click handler + the popup's own close
 * button. Idempotent: app.js calls this once at startup; later calls
 * are no-ops. The handler matches the house delegation style
 * (event.target.closest('[data-…]')) used across app.js.
 */
export function initHelpGuides(doc = null) {
  const root = resolveDocument(doc);
  if (!root || helpGuidesWired) return false;
  if (typeof root.addEventListener !== 'function') return false;
  helpGuidesWired = true;
  root.addEventListener('click', (event) => {
    const target = event && event.target;
    if (!target || typeof target.closest !== 'function') return;
    if (target.closest(`#${HELP_CLOSE_ID}`)) {
      closeHelpGuide(root);
      return;
    }
    const trigger = target.closest('[data-help]');
    if (trigger) openHelpTopic(trigger.getAttribute('data-help'), root);
  });
  return true;
}
