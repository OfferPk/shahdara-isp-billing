// Plan 95 (Plan 1-100) — Service terms acknowledgement record: a dated
// "you agreed to this version on this date" ends the most common
// version of the "nobody told me" dispute, without collecting or
// storing any sensitive personal document.
//
// This module is the RECORD only, and nothing else:
//
//   - It is pure and import-free: the caller supplies every record
//     and every customer, and the module never reads storage, the
//     clock, or the network, and never mutates an input. It holds
//     no money, package, or journey field of its own; a
//     record names a customer, a terms version, a date, and how it
//     was acknowledged (in person, by message, or on paper kept at
//     the shop). No identity document is ever stored here — the
//     record carries a version and a date, nothing else about the
//     person.
//   - One acknowledgement per customer per terms version: saving a
//     second record for the same customer and version replaces the
//     first, so a customer can never carry two answers for one
//     version. A new terms version shows existing customers as
//     "not yet acknowledged" rather than assumed — an old version's
//     acknowledgement never counts for a new version.
//   - Dates are real YYYY-MM-DD calendar dates (2026-02-30 is
//     rejected, never guessed). Half-formed records are refused
//     outright, never stored half-formed.
//   - Recording an acknowledgement never alters any bill, payment,
//     package, or status: the record is only evidence of what was
//     agreed, and the profile line built from it is a display only.
//
// Fence, checked first: no terms-acknowledgement record existed
// before this plan — the onboarding checklist (Plan 16) ticks
// steps, it does not record which terms version a customer agreed
// to. Plan 16 is linked by customer id only, never read or
// rewritten here.

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function validTermsAckDate(value) {
  if (typeof value !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1) return null;
  const daysInMonth = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 30, 31, 30, 31, 30, 31][month - 1];
  return day <= daysInMonth ? value : null;
}

export const TERMS_ACK_METHODS = {
  IN_PERSON: 'in-person',
  MESSAGE: 'message',
  PAPER: 'paper',
};

export const TERMS_ACK_METHOD_LABELS = {
  'in-person': 'In person',
  message: 'By message',
  paper: 'On paper kept at the shop',
};

// Plan 600 — the profile section's status line renders through a
// caller-supplied labels object (the 591 header-strip pattern), so
// this module stays import-free. Defaults are the English strings,
// so old callers (and old tests) keep byte-identical output. The
// Analytics panel's table (termsAckHtml), summary (termsAckSummaryText)
// and CSV (termsAckCsv) are a second surface and stay on the EN
// defaults (D5 logic); only termsAckStatusHtml — the profile section's
// visible line — takes labels from the caller. 'Not recorded' reuses
// prof_not_recorded.
const DEFAULT_TERMS_ACK_LABELS = {
  unavailable: 'Terms acknowledgement unavailable.',
  noVersion: 'No current terms version set yet — set one in the Analytics terms panel first.',
  version: 'Current terms version {version}:',
  acknowledged: 'acknowledged',
  notAcknowledged: 'not yet acknowledged',
  detail: ' on {date} ({method})',
  recordedBy: ', recorded by {name}',
  neverAssumed: ' — never assumed.',
  methodInPerson: 'In person',
  methodMessage: 'By message',
  methodPaper: 'On paper kept at the shop',
  notRecorded: 'Not recorded',
};
function termsLabel(labels, key) {
  return (labels && typeof labels[key] === 'string' && labels[key] !== '') ? labels[key] : DEFAULT_TERMS_ACK_LABELS[key];
}
function termsFill(template, params) {
  let out = String(template);
  for (const [k, v] of Object.entries(params || {})) out = out.split(`{${k}}`).join(String(v));
  return out;
}

export function termsAckMethodLabel(method, labels = DEFAULT_TERMS_ACK_LABELS) {
  const key = { 'in-person': 'methodInPerson', message: 'methodMessage', paper: 'methodPaper' }[method];
  return key ? termsLabel(labels, key) : termsLabel(labels, 'notRecorded');
}

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

// Only these keys ever survive normalisation. Anything else on the
// input — including any identity-document field — is dropped, so
// the record can never become a copy of a personal document.
const TERMS_ACK_KEYS = ['id', 'customer', 'customerName', 'termsVersion', 'date', 'method', 'recordedBy'];

export function normalizeTermsAck(record) {
  if (!record || typeof record !== 'object') return null;
  const id = cleanText(record.id);
  const customer = cleanText(record.customer);
  const termsVersion = cleanText(record.termsVersion);
  const date = validTermsAckDate(record.date);
  const method = cleanText(record.method);
  if (!id || !customer || !termsVersion || !date) return null;
  if (!Object.values(TERMS_ACK_METHODS).includes(method)) return null;
  const out = {
    id,
    customer,
    customerName: cleanText(record.customerName),
    termsVersion,
    date,
    method,
    recordedBy: cleanText(record.recordedBy),
  };
  // Prove the fence: the normalised record carries exactly the
  // allowed keys, nothing more.
  if (Object.keys(out).some((key) => !TERMS_ACK_KEYS.includes(key))) return null;
  return out;
}

export function normalizeTermsAckList(list) {
  if (!Array.isArray(list)) return [];
  const byKey = new Map();
  for (const item of list) {
    const record = normalizeTermsAck(item);
    if (!record) continue;
    // Last record wins for one customer + one version.
    byKey.set(`${record.customer}::${record.termsVersion}`, record);
  }
  return [...byKey.values()];
}

export function upsertTermsAck(list, record) {
  const normalized = normalizeTermsAck(record);
  if (!normalized) return Array.isArray(list) ? normalizeTermsAckList(list) : [];
  const kept = normalizeTermsAckList(list).filter(
    (item) => item.id !== normalized.id
      && !(item.customer === normalized.customer && item.termsVersion === normalized.termsVersion),
  );
  return [...kept, normalized];
}

export function removeTermsAck(list, id) {
  if (!Array.isArray(list)) return [];
  return normalizeTermsAckList(list).filter((item) => item.id !== cleanText(id));
}

export function findTermsAck(list, customer, termsVersion) {
  const records = normalizeTermsAckList(list);
  return records.find(
    (item) => item.customer === cleanText(customer) && item.termsVersion === cleanText(termsVersion),
  ) || null;
}

export function termsAckForCustomer(list, customer) {
  const records = normalizeTermsAckList(list).filter((item) => item.customer === cleanText(customer));
  records.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.termsVersion.localeCompare(b.termsVersion)));
  return records;
}

export function customerTermsStatus(list, customer, currentVersion) {
  const version = cleanText(currentVersion);
  if (!version) {
    return {
      customer: cleanText(customer),
      currentVersion: '',
      acknowledged: false,
      status: 'no-version-set',
      record: null,
      text: 'No current terms version set yet.',
    };
  }
  const record = findTermsAck(list, customer, version);
  if (record) {
    return {
      customer: cleanText(customer),
      currentVersion: version,
      acknowledged: true,
      status: 'acknowledged',
      record,
      text: `Acknowledged version ${version} on ${record.date} (${termsAckMethodLabel(record.method)}).`,
    };
  }
  return {
    customer: cleanText(customer),
    currentVersion: version,
    acknowledged: false,
    status: 'not-yet-acknowledged',
    record: null,
    text: `Not yet acknowledged for version ${version} — never assumed.`,
  };
}

export function buildCustomerTermsRows(list, customers, currentVersion) {
  const rows = (Array.isArray(customers) ? customers : [])
    .filter((item) => item && cleanText(item.id))
    .map((item) => {
      const status = customerTermsStatus(list, item.id, currentVersion);
      return {
        customer: String(item.id),
        customerName: cleanText(item.name || item.customerName) || String(item.id),
        currentVersion: status.currentVersion,
        acknowledged: status.acknowledged,
        status: status.status,
        record: status.record,
        text: status.text,
      };
    });
  rows.sort((a, b) => a.customerName.toLowerCase().localeCompare(b.customerName.toLowerCase()));
  return rows;
}

export function filterTermsAcks(list, filters = {}) {
  const records = normalizeTermsAckList(list);
  const version = cleanText(filters.version);
  const method = cleanText(filters.method);
  const customer = cleanText(filters.customer);
  return records.filter((item) => (
    (!version || item.termsVersion === version)
    && (!method || item.method === method)
    && (!customer || item.customer === customer)
  ));
}

export function termsAckSummaryText(list, currentVersion) {
  const records = normalizeTermsAckList(list);
  const customers = new Set(records.map((item) => item.customer)).size;
  const version = cleanText(currentVersion);
  const base = `${records.length} acknowledgement${records.length === 1 ? '' : 's'} for ${customers} customer${customers === 1 ? '' : 's'}`;
  return version ? `${base} · current terms version ${version}` : `${base} · no current terms version set`;
}

function escapeHtmlText(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

export function termsAckHtml(list) {
  const records = normalizeTermsAckList(list);
  if (records.length === 0) return '<p class="chart-caption">No terms acknowledgements recorded yet.</p>';
  const rows = records.map((item) => `<tr><td>${escapeHtmlText(item.customerName || item.customer)}</td><td>${escapeHtmlText(item.termsVersion)}</td><td>${escapeHtmlText(item.date)}</td><td>${escapeHtmlText(termsAckMethodLabel(item.method))}</td><td>${escapeHtmlText(item.recordedBy || '—')}</td></tr>`).join('');
  return `<table class="data-table"><thead><tr><th>Customer</th><th>Terms version</th><th>Date</th><th>How acknowledged</th><th>Recorded by</th></tr></thead><tbody>${rows}</tbody></table>`;
}

export function termsAckStatusHtml(status, labels = DEFAULT_TERMS_ACK_LABELS) {
  if (!status) return `<p class="chart-caption">${escapeHtmlText(termsLabel(labels, 'unavailable'))}</p>`;
  if (status.status === 'no-version-set') return `<p class="chart-caption">${escapeHtmlText(termsLabel(labels, 'noVersion'))}</p>`;
  const detail = status.record
    ? `${termsFill(termsLabel(labels, 'detail'), { date: escapeHtmlText(status.record.date), method: escapeHtmlText(termsAckMethodLabel(status.record.method, labels)) })}${status.record.recordedBy ? termsFill(termsLabel(labels, 'recordedBy'), { name: escapeHtmlText(status.record.recordedBy) }) : ''}`
    : '';
  return `<p><strong>${escapeHtmlText(termsFill(termsLabel(labels, 'version'), { version: status.currentVersion }))}</strong> ${status.acknowledged ? termsLabel(labels, 'acknowledged') : termsLabel(labels, 'notAcknowledged')}${escapeHtmlText(detail)}${status.acknowledged ? '' : termsLabel(labels, 'neverAssumed')}</p>`;
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function termsAckCsv(list) {
  const records = normalizeTermsAckList(list);
  const header = 'Customer,Customer name,Terms version,Date,How acknowledged,Recorded by';
  const rows = records.map((item) => [
    item.customer, item.customerName, item.termsVersion, item.date, termsAckMethodLabel(item.method), item.recordedBy,
  ].map(csvCell).join(','));
  return [header, ...rows].join('\n');
}

export function termsAckFilename(date) {
  const safe = validTermsAckDate(date) || 'undated';
  return `terms-ack-${safe}.csv`;
}
