/**
 * receipt-footer-studio.js — SISP-96: Customizable Receipt Footer, Shop
 * List & Helpline Studio (storage key sisp_receipt_footer_v1).
 *
 * ONE source of truth for the owner-configured receipt footer:
 * - custom footer text (Urdu / Roman Urdu — owner content, rendered
 *   VERBATIM on every receipt, never translated),
 * - EasyPaisa / NayaPay account numbers,
 * - Helpline WhatsApp number,
 * - collection shops list (one shop per line, verbatim).
 *
 * Every receipt surface renders from the builders in this module:
 * HTML slips (receipt.js), the PNG slip (png-receipt.js), the ESC/POS
 * Bluetooth slip (thermal-printer.js), and both WhatsApp drafts
 * (profile-ui.js via app.js, nav-quick-collect.js). No per-format
 * forked footer strings exist anywhere.
 *
 * Defaults: every field empty. With nothing configured the builders
 * return empty output and every receipt stays byte-identical to what
 * the app produced before this studio existed. The studio ships EMPTY —
 * no phone or account number is ever seeded here; the owner types his
 * own values in Settings.
 *
 * Backup: the settings live outside the ledger state (localStorage key
 * sisp_receipt_footer_v1), so they travel in backups as an optional
 * `settings.receiptFooter` section (core.js create + preview, safe-merge
 * restore), exactly like the #359 digital-payments settings.
 */

export const RECEIPT_FOOTER_STORAGE_KEY = 'sisp_receipt_footer_v1';

const FOOTER_TEXT_MAX = 600;
const FOOTER_TEXT_MAX_LINES = 8;
const SHOPS_TEXT_MAX = 600;
const SHOPS_TEXT_MAX_LINES = 8;
const ACCOUNT_NUMBER_MAX = 34;
const HELPLINE_MAX = 24;

const cleanTextBlock = (value, maxChars, maxLines) => {
  if (typeof value !== 'string') return '';
  const lines = value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== '');
  return lines.slice(0, maxLines).join('\n').slice(0, maxChars);
};

const cleanLine = (value, maxChars) => (typeof value === 'string' ? value.trim().slice(0, maxChars) : '');

/**
 * Returns the factory (empty) receipt footer settings. Pure.
 * @returns {Object}
 */
export function getDefaultReceiptFooter() {
  return {
    footerText: '',
    easypaisaNumber: '',
    nayapayNumber: '',
    helplineWhatsapp: '',
    shopsText: ''
  };
}

/**
 * Cleans and bounds a receipt footer settings object. Pure: no storage
 * access. Used by load/save below and by the backup/restore engine
 * (core.js) so a backup file's settings section is held to exactly the
 * same rules as the Settings dialog. Owner text is kept verbatim apart
 * from outer blank lines and the length bounds.
 * @param {Object} input
 * @returns {Object} Cleaned settings
 */
export function sanitizeReceiptFooter(input = {}) {
  const source = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  return {
    footerText: cleanTextBlock(source.footerText, FOOTER_TEXT_MAX, FOOTER_TEXT_MAX_LINES),
    easypaisaNumber: cleanLine(source.easypaisaNumber, ACCOUNT_NUMBER_MAX),
    nayapayNumber: cleanLine(source.nayapayNumber, ACCOUNT_NUMBER_MAX),
    helplineWhatsapp: cleanLine(source.helplineWhatsapp, HELPLINE_MAX),
    shopsText: cleanTextBlock(source.shopsText, SHOPS_TEXT_MAX, SHOPS_TEXT_MAX_LINES)
  };
}

/**
 * True when at least one footer field is set. An unconfigured footer
 * renders nothing anywhere.
 * @param {Object} footer
 * @returns {boolean}
 */
export function isReceiptFooterConfigured(footer) {
  const cleaned = sanitizeReceiptFooter(footer);
  return Boolean(
    cleaned.footerText
    || cleaned.easypaisaNumber
    || cleaned.nayapayNumber
    || cleaned.helplineWhatsapp
    || cleaned.shopsText
  );
}

/**
 * Loads the receipt footer settings from storage with safe fallback.
 * @param {Storage|null} [storage]
 * @returns {Object}
 */
export function getReceiptFooter(storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  const defaults = getDefaultReceiptFooter();
  if (!storage) return defaults;
  try {
    const raw = storage.getItem(RECEIPT_FOOTER_STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return defaults;
    return sanitizeReceiptFooter(parsed);
  } catch {
    return defaults;
  }
}

/**
 * Validates and saves the receipt footer settings to storage.
 * @param {Object} input
 * @param {Storage|null} [storage]
 * @returns {Object} Validated and saved settings
 */
export function saveReceiptFooter(input = {}, storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  const cleaned = sanitizeReceiptFooter(input);
  if (storage) {
    try {
      storage.setItem(RECEIPT_FOOTER_STORAGE_KEY, JSON.stringify(cleaned));
    } catch (err) {
      console.warn('Could not save receipt footer settings to storage:', err);
    }
  }
  return cleaned;
}

/**
 * The single footer builder every receipt format renders from.
 * Returns the ordered plain-text footer lines:
 *   1. the owner's custom footer text, line by line, verbatim;
 *   2. EasyPaisa / NayaPay account lines (only when a number is set);
 *   3. the Helpline (WhatsApp) line (only when set);
 *   4. the collection shops list, line by line, verbatim.
 * Empty array when nothing is configured — every format then renders
 * exactly what it rendered before this studio existed.
 * @param {Object} footer - raw or sanitized settings
 * @returns {string[]}
 */
export function buildReceiptFooterLines(footer) {
  const cleaned = sanitizeReceiptFooter(footer);
  const lines = [];
  if (cleaned.footerText) lines.push(...cleaned.footerText.split('\n'));
  if (cleaned.easypaisaNumber) lines.push(`EasyPaisa: ${cleaned.easypaisaNumber}`);
  if (cleaned.nayapayNumber) lines.push(`NayaPay: ${cleaned.nayapayNumber}`);
  if (cleaned.helplineWhatsapp) lines.push(`Helpline (WhatsApp): ${cleaned.helplineWhatsapp}`);
  if (cleaned.shopsText) lines.push(...cleaned.shopsText.split('\n'));
  return lines;
}

/**
 * The footer as one plain-text block (WhatsApp drafts, ESC/POS slips).
 * '' when nothing is configured.
 * @param {Object} footer
 * @returns {string}
 */
export function buildReceiptFooterText(footer) {
  return buildReceiptFooterLines(footer).join('\n');
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * The footer as an HTML block for the printed receipt layouts
 * (receipt.js). '' when nothing is configured, so unconfigured
 * receipts stay byte-identical. Each line is escaped and carries
 * dir="auto" so Urdu-script owner text shapes correctly while Latin
 * account lines stay untouched.
 * @param {Object} footer
 * @returns {string}
 */
export function buildReceiptFooterHtml(footer) {
  const lines = buildReceiptFooterLines(footer);
  if (!lines.length) return '';
  const paragraphs = lines
    .map((line) => `    <p class="receipt-footer-line" dir="auto">${escapeHtml(line)}</p>`)
    .join('\n');
  return `<div class="receipt-custom-footer">\n${paragraphs}\n  </div>`;
}

/**
 * Initializes the Receipt Footer Studio dialog (Settings). Mirrors the
 * digital-payments settings modal: populate on open, save on submit,
 * onSave callback for the host's toast. Static labels live in
 * index.html with rcptfoot_* data-i18n keys; this controller only
 * moves values in and out of the form.
 * @param {Object} [options]
 * @returns {Object|null} Controller with open, close, and populate methods
 */
export function initReceiptFooterStudioModal(options = {}) {
  const modal = document.getElementById(options.modalId || 'receiptFooterStudioModal');
  if (!modal) return null;

  const form = document.getElementById('receiptFooterStudioForm');
  const footerTextInput = document.getElementById('settingReceiptFooterText');
  const easypaisaInput = document.getElementById('settingReceiptEasypaisaNumber');
  const nayapayInput = document.getElementById('settingReceiptNayapayNumber');
  const helplineInput = document.getElementById('settingReceiptHelplineWhatsapp');
  const shopsInput = document.getElementById('settingReceiptShopsText');
  const closeBtn = document.getElementById('closeReceiptFooterStudioModalBtn');
  const cancelBtn = document.getElementById('cancelReceiptFooterStudioBtn');
  const triggerBtn = document.getElementById(options.triggerId || 'mobileMoreReceiptFooterBtn');

  function populateForm() {
    const settings = getReceiptFooter();
    if (footerTextInput) footerTextInput.value = settings.footerText || '';
    if (easypaisaInput) easypaisaInput.value = settings.easypaisaNumber || '';
    if (nayapayInput) nayapayInput.value = settings.nayapayNumber || '';
    if (helplineInput) helplineInput.value = settings.helplineWhatsapp || '';
    if (shopsInput) shopsInput.value = settings.shopsText || '';
  }

  function openModal() {
    populateForm();
    if (typeof modal.showModal === 'function') {
      try {
        if (!modal.open) modal.showModal();
      } catch {
        modal.setAttribute('open', '');
      }
    } else {
      modal.setAttribute('open', '');
    }
    footerTextInput?.focus();
  }

  function closeModal() {
    if (typeof modal.close === 'function') {
      try {
        if (modal.open) modal.close();
      } catch {
        modal.removeAttribute('open');
      }
    } else {
      modal.removeAttribute('open');
    }
  }

  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    const updated = saveReceiptFooter({
      footerText: footerTextInput?.value || '',
      easypaisaNumber: easypaisaInput?.value || '',
      nayapayNumber: nayapayInput?.value || '',
      helplineWhatsapp: helplineInput?.value || '',
      shopsText: shopsInput?.value || ''
    });
    closeModal();
    if (typeof options.onSave === 'function') {
      options.onSave(updated);
    }
  });

  closeBtn?.addEventListener('click', closeModal);
  cancelBtn?.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });
  triggerBtn?.addEventListener('click', openModal);

  return {
    open: openModal,
    close: closeModal,
    populate: populateForm
  };
}
