/**
 * emergency-runbook-card.js — SISP-160 [P2]: Printable Emergency NOC,
 * Splicer & Top-10 Feeder Root Homes Runbook Card
 * (ایمرجنسی رن بُک کارڈ).
 *
 * Spec (read-latest.txt, SISP-160 block): "Store emergency contacts
 * (Upstream Bandwidth NOC, Contract Splicer, LESCO/WAPDA Complaint,
 * Shop Numbers) in sisp_emergency_runbook_v1 and combine with the
 * auto-ranked Top 10 upstream root homes into a 1-page printable
 * runbook sheet."
 *
 * Design rules (kept deliberately):
 * - CONTACTS STORE: the contacts live OUTSIDE the ledger state under
 *   their own localStorage key (house sibling-settings pattern, same
 *   as monthly-closing-notes.js), and travel inside JSON backups as an
 *   optional `settings.emergencyRunbook` section under the safe-merge
 *   rule (adopt only when this device has none stored, else a conflict
 *   is reported and nothing is overwritten — wired in core.js).
 * - The store starts COMPLETELY EMPTY. This module NEVER seeds a real
 *   person's name or number: the owner types his own contacts into the
 *   runbook dialog. Empty sections print as "Not recorded".
 * - TOP-10 RANKING is a PURE derivation over the customer list using
 *   outage-impact.js's traceDownstreamImpact (SISP-7 semantics:
 *   transitive downstream, archived customers traversed THROUGH but
 *   never counted). Every customer — root or mid-chain house — with an
 *   ACTIVE downstream count >= 1 is ranked by that count (its blast
 *   radius); ties break by customerNumber ascending. Nothing is stored.
 * - The printed sheet is a standalone A4 HTML document, black on
 *   white (house print pattern, SISP-60 precedent). Rendering and
 *   printing mutate NOTHING; the only write in this module is the
 *   explicit contacts Save action.
 * - This module imports outage-impact.js (zero imports of its own)
 *   and nav-language.js only, so core.js can import the sanitizer
 *   from here without an import cycle.
 * - Tests use synthetic data only.
 */

import { traceDownstreamImpact } from './outage-impact.js';
import { t } from './nav-language.js';

export const EMERGENCY_RUNBOOK_KEY = 'sisp_emergency_runbook_v1';

/** Maximum number of shop contacts on the runbook card. */
export const EMERGENCY_RUNBOOK_SHOP_CAP = 6;

/** House text caps for owner-entered contact fields. */
export const EMERGENCY_RUNBOOK_LABEL_CAP = 80;
export const EMERGENCY_RUNBOOK_PHONE_CAP = 40;

function cleanText(value, cap) {
  return typeof value === 'string' ? value.trim().slice(0, cap) : '';
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

function sanitizeContact(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { label: '', phone: '' };
  }
  return {
    label: cleanText(value.label, EMERGENCY_RUNBOOK_LABEL_CAP),
    phone: cleanText(value.phone, EMERGENCY_RUNBOOK_PHONE_CAP)
  };
}

/**
 * Normalizes a raw runbook value into
 *   { upstreamNoc: {label, phone}, splicer: {label, phone},
 *     lesco: {label, phone}, shops: [{label, phone}] }
 * Malformed entries are dropped, never thrown on. A shop entry is kept
 * only when it carries a label or a phone; the shop list is capped at
 * EMERGENCY_RUNBOOK_SHOP_CAP entries. The empty store sanitizes to
 * three empty contacts and an empty shop list — never to seeded data.
 */
export function sanitizeEmergencyRunbook(value) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const shops = [];
  if (Array.isArray(source.shops)) {
    for (const entry of source.shops) {
      if (shops.length >= EMERGENCY_RUNBOOK_SHOP_CAP) break;
      const clean = sanitizeContact(entry);
      if (!clean.label && !clean.phone) continue;
      shops.push(clean);
    }
  }
  return {
    upstreamNoc: sanitizeContact(source.upstreamNoc),
    splicer: sanitizeContact(source.splicer),
    lesco: sanitizeContact(source.lesco),
    shops
  };
}

/** True when the (sanitized) runbook holds at least one typed field. */
export function hasEmergencyRunbookContacts(value) {
  const clean = sanitizeEmergencyRunbook(value);
  const fixed = [clean.upstreamNoc, clean.splicer, clean.lesco];
  return fixed.some((c) => c.label || c.phone)
    || clean.shops.some((c) => c.label || c.phone);
}

/** Reads saved emergency contacts; the empty store on missing/corrupt. */
export function loadEmergencyRunbook(storage) {
  try {
    const store = storage || (typeof globalThis !== 'undefined' ? globalThis.localStorage : null);
    if (!store) return sanitizeEmergencyRunbook(null);
    const raw = store.getItem(EMERGENCY_RUNBOOK_KEY);
    if (!raw) return sanitizeEmergencyRunbook(null);
    return sanitizeEmergencyRunbook(JSON.parse(raw));
  } catch {
    return sanitizeEmergencyRunbook(null);
  }
}

/** Persists emergency contacts (sanitized); never throws. */
export function saveEmergencyRunbook(runbook, storage) {
  try {
    const store = storage || (typeof globalThis !== 'undefined' ? globalThis.localStorage : null);
    if (!store) return false;
    store.setItem(EMERGENCY_RUNBOOK_KEY, JSON.stringify(sanitizeEmergencyRunbook(runbook)));
    return true;
  } catch {
    return false;
  }
}

/**
 * Ranks houses by blast radius: for every customer, the ACTIVE
 * downstream count from traceDownstreamImpact (archived downstreams
 * are traversed through but never counted). Houses with count >= 1
 * are sorted by count descending, ties by customerNumber ascending
 * (missing numbers last, then id for stability), and cut to `limit`
 * (default 10). Pure and read-only.
 *
 * Each row: { customerId, customerNumber, name, mohalla, phone,
 * splitterBoxId, downstreamCount } — name/mohalla/phone/splitter box
 * exactly as recorded ('' when unset, never invented).
 */
export function buildTopRootHomes(customers, limit = 10) {
  const list = Array.isArray(customers) ? customers : [];
  const cap = Number.isInteger(limit) && limit > 0 ? limit : 10;
  const rows = [];
  for (const customer of list) {
    if (!customer || typeof customer !== 'object' || customer.id === null || customer.id === undefined) continue;
    const downstreamCount = traceDownstreamImpact(list, customer.id).length;
    if (downstreamCount < 1) continue;
    const number = Number(customer.customerNumber);
    rows.push({
      customerId: String(customer.id),
      customerNumber: Number.isFinite(number) ? number : null,
      name: cleanText(customer.name, 200),
      mohalla: cleanText(customer.mohalla, 200),
      phone: cleanText(customer.phone, 100),
      splitterBoxId: cleanText(customer.splitterBoxId, 100),
      downstreamCount
    });
  }
  rows.sort((a, b) => {
    if (b.downstreamCount !== a.downstreamCount) return b.downstreamCount - a.downstreamCount;
    const an = a.customerNumber === null ? Number.MAX_SAFE_INTEGER : a.customerNumber;
    const bn = b.customerNumber === null ? Number.MAX_SAFE_INTEGER : b.customerNumber;
    if (an !== bn) return an - bn;
    return a.customerId < b.customerId ? -1 : a.customerId > b.customerId ? 1 : 0;
  });
  return rows.slice(0, cap);
}

/** PKT stamp for the sheet header, e.g. "30 Oct 2026, 02:30 PKT". */
export function formatRunbookGeneratedAt(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  const safe = Number.isNaN(date.getTime()) ? new Date() : date;
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Karachi',
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false
  }).format(safe);
  return `${parts} PKT`;
}

/**
 * Builds the full runbook model: sanitized contacts + ranked homes.
 * Pure and read-only.
 */
export function buildEmergencyRunbook(customers, runbook, { limit = 10 } = {}) {
  return {
    contacts: sanitizeEmergencyRunbook(runbook),
    topHomes: buildTopRootHomes(customers, limit)
  };
}

function contactRowHtml(label, contact, lang) {
  const name = contact.label || label;
  const phone = contact.phone || t('runbook_not_recorded', lang);
  return `<tr><td class="contact-name">${escapeHtml(name)}</td><td class="contact-phone">${escapeHtml(phone)}</td></tr>`;
}

/**
 * Generates the printable 1-page A4 Emergency Runbook sheet. Paper
 * output follows the house print conventions: a standalone HTML
 * document, black on white. Section headings follow the requested
 * language via t(); owner-entered labels/phones and recorded customer
 * data print verbatim. Missing contacts print "Not recorded" — a
 * number is never invented.
 */
export function generateEmergencyRunbookPrintHtml({
  customers = [],
  runbook = null,
  lang = null,
  generatedAt = new Date()
} = {}) {
  const { contacts, topHomes } = buildEmergencyRunbook(customers, runbook);
  const generated = formatRunbookGeneratedAt(generatedAt);

  const shopRows = contacts.shops.length
    ? contacts.shops.map((shop) => contactRowHtml(t('runbook_shop_label', lang), shop, lang)).join('')
    : contactRowHtml(t('runbook_shop_label', lang), { label: '', phone: '' }, lang);

  const contactsHtml = [
    contactRowHtml(t('runbook_noc_label', lang), contacts.upstreamNoc, lang),
    contactRowHtml(t('runbook_splicer_label', lang), contacts.splicer, lang),
    contactRowHtml(t('runbook_lesco_label', lang), contacts.lesco, lang),
    shopRows
  ].join('');

  const homeRows = topHomes.map((row, index) => `
      <tr>
        <td class="rank">${index + 1}</td>
        <td>${escapeHtml(row.name || '—')}</td>
        <td class="num">${row.customerNumber === null ? '—' : `#${row.customerNumber}`}</td>
        <td>${escapeHtml(row.mohalla || '—')}</td>
        <td>${escapeHtml(row.phone || '—')}</td>
        <td>${escapeHtml(row.splitterBoxId || '—')}</td>
        <td class="num downstream">${row.downstreamCount}</td>
      </tr>`).join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(t('runbook_sheet_title', lang))}</title>
  <style>
    @page { size: A4; margin: 12mm; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; margin: 0; color: #111; font-size: 12px; line-height: 1.4; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #000; padding-bottom: 6px; margin-bottom: 10px; }
    .brand { font-size: 19px; font-weight: 800; }
    .title { font-size: 14px; font-weight: 700; }
    .meta { font-size: 11px; text-align: right; }
    h3 { font-size: 13px; margin: 14px 0 6px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #999; padding: 5px 6px; text-align: left; vertical-align: top; }
    th { background: #eee; font-size: 11px; }
    td.num, th.num { text-align: right; white-space: nowrap; }
    td.rank { font-weight: 700; text-align: center; }
    td.downstream { font-weight: 800; }
    td.contact-name { font-weight: 600; }
    td.contact-phone { white-space: nowrap; }
    .empty { text-align: center; padding: 16px; font-size: 12px; }
    .footer { margin-top: 16px; font-size: 11px; border-top: 1px solid #999; padding-top: 6px; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="brand">SHAHDARA FIBER NET</div>
      <div class="title">${escapeHtml(t('runbook_sheet_title', lang))}</div>
    </div>
    <div class="meta"><div>${escapeHtml(t('runbook_generated', lang, { datetime: generated }))}</div></div>
  </div>
  <h3>${escapeHtml(t('runbook_contacts_heading', lang))}</h3>
  <table>
    <tbody>${contactsHtml}</tbody>
  </table>
  <h3>${escapeHtml(t('runbook_top_heading', lang))}</h3>
  ${topHomes.length ? `<table>
    <thead>
      <tr>
        <th>${escapeHtml(t('runbook_col_rank', lang))}</th>
        <th>${escapeHtml(t('runbook_col_house', lang))}</th>
        <th>${escapeHtml(t('runbook_col_customer', lang))}</th>
        <th>${escapeHtml(t('runbook_col_mohalla', lang))}</th>
        <th>${escapeHtml(t('runbook_col_phone', lang))}</th>
        <th>${escapeHtml(t('runbook_col_splitter', lang))}</th>
        <th class="num">${escapeHtml(t('runbook_col_downstream', lang))}</th>
      </tr>
    </thead>
    <tbody>${homeRows}</tbody>
  </table>` : `<div class="empty">${escapeHtml(t('runbook_no_root_homes', lang))}</div>`}
  <div class="footer">${escapeHtml(t('runbook_footer', lang))}</div>
</body>
</html>`;
}

/**
 * Controller for the Emergency Runbook dialog (opened from the Home
 * dashboard's Feeder Outage Impact card). The dialog carries the
 * contacts form (3 fixed contacts + up to SHOP_CAP shop rows), a live
 * Top-10 preview, a Save action (the ONLY write) and a Print action.
 * Returns null when there is no DOM or no dialog markup.
 *
 * @param {Object|Function} getState - State object or () => state
 * @param {Object} [options]
 * @param {Function} [options.getRunbook] - () => saved contacts
 *   (defaults to loadEmergencyRunbook)
 * @param {Function} [options.onSaveRunbook] - (sanitized) => void
 *   (defaults to saveEmergencyRunbook)
 * @param {Function} [options.onToast]
 */
export function setupEmergencyRunbookDialog(getState, { getRunbook = null, onSaveRunbook = null, onToast = null } = {}) {
  if (typeof document === 'undefined') return null;
  const dialog = document.getElementById('emergencyRunbookDialog');
  if (!dialog) return null;

  const $ = (id) => document.getElementById(id);
  const readState = () => (typeof getState === 'function' ? getState() : getState);
  const readSaved = () => {
    try {
      const value = typeof getRunbook === 'function' ? getRunbook() : getRunbook;
      return sanitizeEmergencyRunbook(value ?? loadEmergencyRunbook());
    } catch {
      return loadEmergencyRunbook();
    }
  };

  const fixedFields = [
    ['upstreamNoc', 'runbookNocLabel', 'runbookNocPhone'],
    ['splicer', 'runbookSplicerLabel', 'runbookSplicerPhone'],
    ['lesco', 'runbookLescoLabel', 'runbookLescoPhone']
  ];

  function fillForm(contacts) {
    for (const [key, labelId, phoneId] of fixedFields) {
      const labelEl = $(labelId);
      const phoneEl = $(phoneId);
      if (labelEl) labelEl.value = contacts[key].label;
      if (phoneEl) phoneEl.value = contacts[key].phone;
    }
    for (let i = 1; i <= EMERGENCY_RUNBOOK_SHOP_CAP; i++) {
      const labelEl = $(`runbookShopLabel${i}`);
      const phoneEl = $(`runbookShopPhone${i}`);
      const shop = contacts.shops[i - 1] || { label: '', phone: '' };
      if (labelEl) labelEl.value = shop.label;
      if (phoneEl) phoneEl.value = shop.phone;
    }
  }

  function collectForm() {
    const raw = { shops: [] };
    for (const [key, labelId, phoneId] of fixedFields) {
      raw[key] = { label: $(labelId)?.value ?? '', phone: $(phoneId)?.value ?? '' };
    }
    for (let i = 1; i <= EMERGENCY_RUNBOOK_SHOP_CAP; i++) {
      raw.shops.push({ label: $(`runbookShopLabel${i}`)?.value ?? '', phone: $(`runbookShopPhone${i}`)?.value ?? '' });
    }
    return sanitizeEmergencyRunbook(raw);
  }

  function renderPreview() {
    const preview = $('runbookPreview');
    const list = $('runbookTopList');
    const customers = readState()?.customers ?? [];
    const topHomes = buildTopRootHomes(customers);
    if (preview) {
      preview.textContent = topHomes.length
        ? t('runbook_preview', null, { count: topHomes.length })
        : t('runbook_preview_empty');
    }
    if (list) {
      list.innerHTML = topHomes.map((row, index) => {
        const label = `${index + 1}. ${row.name || '—'}${row.customerNumber === null ? '' : ` (#${row.customerNumber})`} — ${row.downstreamCount}`;
        return `<li>${escapeHtml(label)}</li>`;
      }).join('');
    }
    return topHomes;
  }

  function render() {
    fillForm(readSaved());
    return renderPreview();
  }

  const openBtn = $('openEmergencyRunbookBtn');
  if (openBtn) {
    openBtn.addEventListener('click', () => {
      if (dialog.showModal) dialog.showModal();
      else dialog.hidden = false;
      render();
    });
  }
  const closeBtn = $('runbookCloseBtn');
  if (closeBtn) closeBtn.addEventListener('click', () => { dialog.close?.() || (dialog.hidden = true); });
  const closeBtn2 = $('runbookCloseBtn2');
  if (closeBtn2) closeBtn2.addEventListener('click', () => { dialog.close?.() || (dialog.hidden = true); });

  const saveBtn = $('runbookSaveBtn');
  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      const contacts = collectForm();
      if (typeof onSaveRunbook === 'function') onSaveRunbook(contacts);
      else saveEmergencyRunbook(contacts);
      if (typeof onToast === 'function') onToast(t('runbook_saved'));
    });
  }

  const printBtn = $('runbookPrintBtn');
  if (printBtn) {
    printBtn.addEventListener('click', () => {
      const html = generateEmergencyRunbookPrintHtml({
        customers: readState()?.customers ?? [],
        runbook: collectForm(),
        generatedAt: new Date()
      });
      const win = window.open('', '_blank');
      if (win) {
        win.document.write(html);
        win.document.close();
        win.focus();
        win.print();
      } else if (typeof onToast === 'function') {
        onToast(t('runbook_popup_blocked'));
      }
    });
  }

  return {
    open: () => {
      if (dialog.showModal) dialog.showModal();
      else dialog.hidden = false;
      render();
    },
    close: () => { dialog.close?.() || (dialog.hidden = true); },
    refresh: render,
    collectForm,
    getTopHomes: () => buildTopRootHomes(readState()?.customers ?? [])
  };
}
