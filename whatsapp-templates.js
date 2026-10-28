/**
 * whatsapp-templates.js - SISP-25: customizable WhatsApp message templates.
 *
 * The operator sends monthly reminders, polite 5th-of-month bill notices,
 * Waada expiry follow-ups and outage alerts by hand (1-tap, never automatic).
 * Each of the five message types is editable in the Template Studio in both
 * Roman Urdu and Urdu script, and rendered with live customer values before
 * sending. Rendering never leaves an "undefined" or a raw {placeholder} in
 * the outgoing text: unknown or missing values render as an empty string.
 */
import { displayCustomerName } from './urdu-names.js';

/* This module imports nothing from core.js on purpose: core.js imports
 * whatsapp-templates.js for the backup sanitizer (see createJsonBackup).
 * PKR formatting is done locally with the same Intl en-PK rule core.js uses. */
function formatPkrLocal(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return '';
  const formatter = new Intl.NumberFormat('en-PK', { minimumFractionDigits: Number.isInteger(amount) ? 0 : 2, maximumFractionDigits: 2 });
  return `PKR ${formatter.format(amount)}`;
}

export const WA_TEMPLATES_STORAGE_KEY = 'sisp_wa_templates_v1';

/** Template ids, in studio order. */
export const WA_TEMPLATE_IDS = Object.freeze(['billGenerated', 'politeReminder', 'brokenWaada', 'outageNotice', 'paymentReceived']);

export const WA_TEMPLATE_LABELS = Object.freeze({
  billGenerated: 'Bill Generated',
  politeReminder: 'Polite Reminder',
  brokenWaada: 'Broken Waada Alert',
  outageNotice: 'Outage Notice',
  paymentReceived: 'Payment Received'
});

export const WA_TEMPLATE_DESCRIPTIONS = Object.freeze({
  billGenerated: 'Sent when a new monthly bill is generated.',
  politeReminder: 'Polite 5th-of-month bill notice.',
  brokenWaada: 'Follow-up when a promised payment date has passed unpaid.',
  outageNotice: 'Service interruption or outage alert.',
  paymentReceived: 'Confirmation when a payment is received.'
});

/** Placeholders every template may use. */
export const WA_PLACEHOLDER_KEYS = Object.freeze(['name', 'urduName', 'connectionId', 'package', 'totalDue', 'waadaDate']);

const text = value => typeof value === 'string' ? value : '';

/** Default templates. Roman Urdu is the working default; Urdu script is the alternate variant. */
export const DEFAULT_WA_TEMPLATES = Object.freeze([
  {
    id: 'billGenerated',
    roman: 'Assalam-o-Alaikum {name}, aap ka {package} ka bill ban gaya hai. Total due: {totalDue}. Shukriya — Shahdara Fiber Net.',
    urdu: 'السلام علیکم {urduName}، آپ کا {package} کا بل بن گیا ہے۔ کل واجب الادا: {totalDue}۔ شکریہ — شاہدرہ فائبر نیٹ۔'
  },
  {
    id: 'politeReminder',
    roman: 'Assalam-o-Alaikum {name}, yaad dehani: aap ke {package} ka bill {totalDue} baaqi hai. Baraye meherbani 5 tareekh tak ada farma dein. Shukriya!',
    urdu: 'السلام علیکم {urduName}، یاد دہانی: آپ کے {package} کا بل {totalDue} باقی ہے۔ برائے مہربانی 5 تاریخ تک ادا فرما دیں۔ شکریہ!'
  },
  {
    id: 'brokenWaada',
    roman: 'Assalam-o-Alaikum {name}, aap ne {waadaDate} tak adaigi ka waada kiya tha jo poora na ho saka. Baqaya {totalDue} hai — baraye meherbani jald ada farma dein.',
    urdu: 'السلام علیکم {urduName}، آپ نے {waadaDate} تک ادائیگی کا وعدہ کیا تھا جو پورا نہ ہو سکا۔ بقایا {totalDue} ہے — برائے مہربانی جلد ادا فرما دیں۔'
  },
  {
    id: 'outageNotice',
    roman: 'Assalam-o-Alaikum {name}, {package} service mein khalal ki ittila hai. Hamari team kaam kar rahi hai, jald bahaal ho jayegi. Takleef ke liye mazrat.',
    urdu: 'السلام علیکم {urduName}، {package} سروس میں خلل کی اطلاع ہے۔ ہماری ٹیم کام کر رہی ہے، جلد بحال ہو جائے گی۔ تکلیف کے لیے معذرت۔'
  },
  {
    id: 'paymentReceived',
    roman: 'Assalam-o-Alaikum {name}, aap ki adaigi {totalDue} moosool ho gayi hai. Shukriya!',
    urdu: 'السلام علیکم {urduName}، آپ کی ادائیگی {totalDue} موصول ہو گئی ہے۔ شکریہ!'
  }
]);

function normalizeTemplateEntry(entry) {
  const found = DEFAULT_WA_TEMPLATES.find(def => def.id === entry?.id);
  if (!found) return null;
  const roman = text(entry.roman).trim();
  const urdu = text(entry.urdu).trim();
  return { id: found.id, roman: roman || found.roman, urdu: urdu || found.urdu };
}

function readStored(storage) {
  if (!storage || typeof storage.getItem !== 'function') return [];
  try {
    const parsed = JSON.parse(storage.getItem(WA_TEMPLATES_STORAGE_KEY) || 'null');
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

/** All five templates: stored customizations merged over defaults. Safe on corrupt or missing storage. */
export function getWaTemplates(storage = null) {
  const target = storage ?? (typeof localStorage !== 'undefined' ? localStorage : null);
  const stored = readStored(target);
  return DEFAULT_WA_TEMPLATES.map(def => {
    const custom = stored.find(entry => entry?.id === def.id);
    if (!custom) return { ...def };
    return normalizeTemplateEntry(custom) || { ...def };
  });
}

export function getWaTemplate(templates, id) {
  const list = Array.isArray(templates) ? templates : getWaTemplates();
  return list.find(entry => entry?.id === id) || DEFAULT_WA_TEMPLATES.find(def => def.id === id) || null;
}

/** Stored customizations only (sanitized), for backup export: [] when nothing was ever saved. */
export function getStoredWaTemplates(storage = null) {
  const target = storage ?? (typeof localStorage !== 'undefined' ? localStorage : null);
  return sanitizeWaTemplates(readStored(target));
}

/** Persists a full template list (unknown ids dropped, empty variants fall back to defaults). */
export function saveWaTemplates(storage, templates) {
  const target = storage ?? (typeof localStorage !== 'undefined' ? localStorage : null);
  const cleaned = (Array.isArray(templates) ? templates : []).map(normalizeTemplateEntry).filter(Boolean);
  const merged = DEFAULT_WA_TEMPLATES.map(def => cleaned.find(entry => entry.id === def.id) || { ...def });
  if (target && typeof target.setItem === 'function') {
    try { target.setItem(WA_TEMPLATES_STORAGE_KEY, JSON.stringify(merged)); } catch {}
  }
  return merged;
}

/** Updates one template's variants (pass { roman } and/or { urdu }); returns the full list. */
export function updateWaTemplate(storage, id, patch = {}) {
  const templates = getWaTemplates(storage);
  const updated = templates.map(entry => {
    if (entry.id !== id) return entry;
    const roman = text(patch.roman).trim();
    const urdu = text(patch.urdu).trim();
    return { id: entry.id, roman: roman || entry.roman, urdu: urdu || entry.urdu };
  });
  return saveWaTemplates(storage, updated);
}

/** Placeholder values for one customer. extras override: { totalDue, waadaDate, package }. */
export function resolveWaTemplateValues(customer, extras = {}) {
  const totalDueRaw = extras.totalDue ?? extras.amount ?? null;
  const totalDue = totalDueRaw === null || totalDueRaw === undefined || totalDueRaw === ''
    ? ''
    : (typeof totalDueRaw === 'number' ? formatPkrLocal(totalDueRaw) : String(totalDueRaw).trim());
  return {
    name: text(customer?.name).trim(),
    urduName: displayCustomerName(customer ?? {}, 'ur'),
    connectionId: String(customer?.connectionId ?? customer?.customerNumber ?? '').trim(),
    package: text(customer?.packageSpeed).trim() || text(extras.package).trim(),
    totalDue,
    waadaDate: text(customer?.promiseDate).trim() || text(customer?.waadaDate).trim() || text(extras.waadaDate).trim()
  };
}

/**
 * Renders template text with values. Every {placeholder} is substituted;
 * missing or unknown placeholders become an empty string, so the result
 * never contains "undefined" or a raw {token}.
 */
export function renderWaTemplate(templateText, values = {}) {
  let out = text(templateText);
  for (const key of WA_PLACEHOLDER_KEYS) {
    const value = values?.[key];
    out = out.split(`{${key}}`).join(value === null || value === undefined ? '' : String(value));
  }
  return out.replace(/\{[A-Za-z0-9_]+\}/g, '');
}

/** Renders one template id for a customer. variant: 'roman' (default) or 'urdu'. */
export function renderWaTemplateFor(templates, id, customer, extras = {}, variant = 'roman') {
  const template = getWaTemplate(templates, id);
  if (!template) return '';
  const body = variant === 'urdu' ? (text(template.urdu).trim() || template.roman) : (text(template.roman).trim() || template.urdu);
  return renderWaTemplate(body, resolveWaTemplateValues(customer, extras));
}

/** Backup sanitizer: keeps known template ids only, trims variants, drops empties. */
export function sanitizeWaTemplates(entries) {
  if (!Array.isArray(entries)) return [];
  const out = [];
  for (const entry of entries) {
    const found = DEFAULT_WA_TEMPLATES.find(def => def.id === entry?.id);
    if (!found) continue;
    const roman = text(entry.roman).trim();
    const urdu = text(entry.urdu).trim();
    if (!roman && !urdu) continue;
    out.push({ id: found.id, roman: roman || found.roman, urdu: urdu || found.urdu });
  }
  return out;
}

/** Payment Received message for a receipt: {totalDue} is the amount just received. */
export function buildPaymentReceivedMessage(customer, payment, templates = null, variant = 'roman') {
  const list = Array.isArray(templates) ? templates : getWaTemplates();
  return renderWaTemplateFor(list, 'paymentReceived', customer, { totalDue: payment?.amount ?? payment?.totalDue ?? null }, variant);
}
