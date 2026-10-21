/**
 * digital-payments-settings.js - Owner Digital Payments, Raast, Till & QR Settings
 * (agent4 - shahdara-polish-qa)
 *
 * Implements owner digital payment configuration for Pakistani ISP field billing:
 * - Raast P2M ID (phone or IBAN)
 * - Merchant Till ID (JazzCash / Easypaisa)
 * - Account Title & Bank Name / Account number
 * - Static QR code image (upload, local base64 persistence, size-limited)
 * - Auto-formatting for receipt stubs, customer account statements, and WhatsApp reminder drafts.
 */

export const DIGITAL_PAYMENTS_SETTINGS_KEY = 'shahdara_digital_payments_settings_v1';

/**
 * Returns clean default settings object.
 * @returns {Object}
 */
export function getDefaultDigitalPaymentsSettings() {
  return {
    ownerRaastId: '',
    ownerTillId: '',
    ownerAccountTitle: 'Shahdara Fiber Net',
    ownerPhone: '',
    ownerBankName: '',
    ownerAccountNumber: '',
    ownerQrDataUrl: '',
    instructions: 'Send screenshot with Transaction ID on WhatsApp after paying / ادائیگی کے بعد رسید واٹس ایپ کریں'
  };
}

/**
 * Cleans and bounds a digital payment settings object. Pure: no storage access.
 * Used by load/save below and by the backup/restore engine (core.js) so a backup
 * file's settings section is held to exactly the same rules as the dialog.
 * @param {Object} input
 * @returns {Object} Cleaned settings
 */
export function sanitizeDigitalPaymentsSettings(input = {}) {
  const defaults = getDefaultDigitalPaymentsSettings();
  const source = input && typeof input === 'object' ? input : {};
  return {
    ownerRaastId: String(source.ownerRaastId ?? '').trim().slice(0, 40),
    ownerTillId: String(source.ownerTillId ?? '').trim().slice(0, 30),
    ownerAccountTitle: String(source.ownerAccountTitle ?? defaults.ownerAccountTitle).trim().slice(0, 100),
    ownerPhone: String(source.ownerPhone ?? '').trim().slice(0, 20),
    ownerBankName: String(source.ownerBankName ?? '').trim().slice(0, 80),
    ownerAccountNumber: String(source.ownerAccountNumber ?? '').trim().slice(0, 50),
    ownerQrDataUrl: (typeof source.ownerQrDataUrl === 'string' && source.ownerQrDataUrl.startsWith('data:image/'))
      ? source.ownerQrDataUrl.slice(0, 350000)
      : '',
    instructions: String(source.instructions ?? defaults.instructions).trim().slice(0, 200)
  };
}

/**
 * Loads digital payment settings from storage with safe fallback.
 * @param {Storage|null} [storage]
 * @returns {Object}
 */
export function getDigitalPaymentsSettings(storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  const defaults = getDefaultDigitalPaymentsSettings();
  if (!storage) return defaults;
  try {
    const raw = storage.getItem(DIGITAL_PAYMENTS_SETTINGS_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return defaults;
    return sanitizeDigitalPaymentsSettings(parsed);
  } catch {
    return defaults;
  }
}

/**
 * Validates and saves digital payment settings to storage.
 * @param {Object} input
 * @param {Storage|null} [storage]
 * @returns {Object} Validated and saved settings
 */
export function saveDigitalPaymentsSettings(input = {}, storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  const cleaned = sanitizeDigitalPaymentsSettings(input);

  if (storage) {
    try {
      storage.setItem(DIGITAL_PAYMENTS_SETTINGS_KEY, JSON.stringify(cleaned));
    } catch (err) {
      console.warn('Could not save digital payments settings to storage:', err);
    }
  }

  return cleaned;
}

/**
 * Checks if owner has configured at least one digital payment receiver method.
 * @param {Object} settings
 * @returns {boolean}
 */
export function hasConfiguredDigitalPayments(settings) {
  if (!settings || typeof settings !== 'object') return false;
  return Boolean(
    settings.ownerRaastId ||
    settings.ownerTillId ||
    settings.ownerAccountNumber ||
    settings.ownerQrDataUrl
  );
}

/**
 * Formats a concise digital payment instruction block for WhatsApp reminder text.
 * @param {Object} settings
 * @returns {string}
 */
export function formatDigitalPaymentWhatsAppText(settings) {
  if (!settings || !hasConfiguredDigitalPayments(settings)) return '';
  const lines = ['\n💳 Digital / آن لائن ادائیگی:'];
  if (settings.ownerAccountTitle) lines.push(`• Title / نام: ${settings.ownerAccountTitle}`);
  if (settings.ownerRaastId) lines.push(`• ⚡ Raast ID: ${settings.ownerRaastId}`);
  if (settings.ownerTillId) lines.push(`• 📱 Till ID (JazzCash/Easypaisa): ${settings.ownerTillId}`);
  if (settings.ownerBankName && settings.ownerAccountNumber) {
    lines.push(`• 🏦 ${settings.ownerBankName}: ${settings.ownerAccountNumber}`);
  }
  if (settings.instructions) {
    lines.push(`• نوٹ: ${settings.instructions}`);
  }
  return lines.join('\n');
}

/**
 * Formats a single-line summary note for thermal and print receipts.
 * @param {Object} settings
 * @returns {string}
 */
export function formatDigitalPaymentReceiptNote(settings) {
  if (!settings || !hasConfiguredDigitalPayments(settings)) return '';
  const parts = [];
  if (settings.ownerRaastId) parts.push(`Raast: ${settings.ownerRaastId}`);
  if (settings.ownerTillId) parts.push(`Till: ${settings.ownerTillId}`);
  if (settings.ownerAccountTitle) parts.push(`(${settings.ownerAccountTitle})`);
  return parts.join(' · ');
}

/**
 * Initializes the Digital Payments & QR Settings Modal dialog.
 * @param {Object} [options]
 * @returns {Object} Controller with open, close, and populate methods
 */
export function initDigitalPaymentsSettingsModal(options = {}) {
  const modal = document.getElementById(options.modalId || 'digitalPaymentsSettingsModal');
  if (!modal) return null;

  const form = document.getElementById('digitalPaymentsSettingsForm');
  const raastInput = document.getElementById('settingOwnerRaastId');
  const tillInput = document.getElementById('settingOwnerTillId');
  const titleInput = document.getElementById('settingOwnerAccountTitle');
  const ownerPhoneInput = document.getElementById('settingOwnerPhone');
  const bankInput = document.getElementById('settingOwnerBankName');
  const acctInput = document.getElementById('settingOwnerAccountNumber');
  const qrFileInput = document.getElementById('settingOwnerQrFile');
  const qrPreview = document.getElementById('settingOwnerQrPreview');
  const qrPreviewWrap = document.getElementById('settingOwnerQrPreviewWrap');
  const removeQrBtn = document.getElementById('settingRemoveOwnerQrBtn');
  const instructionsInput = document.getElementById('settingDigitalInstructions');
  const closeBtn = document.getElementById('closeDigitalPaymentsSettingsModalBtn');
  const cancelBtn = document.getElementById('cancelDigitalPaymentsSettingsBtn');
  const triggerBtn = document.getElementById(options.triggerId || 'mobileMoreDigitalSettingsBtn');

  let currentQrDataUrl = '';

  function populateForm() {
    const settings = getDigitalPaymentsSettings();
    if (raastInput) raastInput.value = settings.ownerRaastId || '';
    if (tillInput) tillInput.value = settings.ownerTillId || '';
    if (titleInput) titleInput.value = settings.ownerAccountTitle || 'Shahdara Fiber Net';
    if (ownerPhoneInput) {
      let savedPhone = settings.ownerPhone || '';
      if (!savedPhone) {
        try { savedPhone = localStorage.getItem('shahdara_owner_whatsapp_phone') || ''; } catch {}
      }
      ownerPhoneInput.value = savedPhone;
    }
    if (bankInput) bankInput.value = settings.ownerBankName || '';
    if (acctInput) acctInput.value = settings.ownerAccountNumber || '';
    if (instructionsInput) instructionsInput.value = settings.instructions || '';

    currentQrDataUrl = settings.ownerQrDataUrl || '';
    updateQrPreview();
  }

  function updateQrPreview() {
    if (qrPreview && qrPreviewWrap) {
      if (currentQrDataUrl) {
        qrPreview.src = currentQrDataUrl;
        qrPreviewWrap.hidden = false;
      } else {
        qrPreview.src = '';
        qrPreviewWrap.hidden = true;
      }
    }
  }

  // Handle QR file selection
  qrFileInput?.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 500 * 1024) {
      alert('QR image must be smaller than 500 KB.');
      qrFileInput.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      currentQrDataUrl = event.target?.result || '';
      updateQrPreview();
    };
    reader.readAsDataURL(file);
  });

  removeQrBtn?.addEventListener('click', () => {
    currentQrDataUrl = '';
    if (qrFileInput) qrFileInput.value = '';
    updateQrPreview();
  });

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
    raastInput?.focus();
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

  // Form submit
  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    const phoneVal = ownerPhoneInput?.value || '';
    const updated = saveDigitalPaymentsSettings({
      ownerRaastId: raastInput?.value || '',
      ownerTillId: tillInput?.value || '',
      ownerAccountTitle: titleInput?.value || '',
      ownerPhone: phoneVal,
      ownerBankName: bankInput?.value || '',
      ownerAccountNumber: acctInput?.value || '',
      ownerQrDataUrl: currentQrDataUrl,
      instructions: instructionsInput?.value || ''
    });

    if (phoneVal) {
      try { localStorage.setItem('shahdara_owner_whatsapp_phone', phoneVal); } catch {}
    }

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
