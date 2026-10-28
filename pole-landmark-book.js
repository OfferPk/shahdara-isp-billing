/**
 * pole-landmark-book.js — SISP-32: Street Pole, Landmark & Fiber Drop Wire
 * Color Directory.
 *
 * Problem (spec): a lineman needs an offline directory of which pole or
 * landmark carries which customer's fiber drop and media converter box, so
 * any new lineman can locate the box in 30 seconds.
 *
 * What it is:
 * - Three OPTIONAL fields on the customer record (core.js): poleNumber
 *   (e.g. "Pole #14 near Masjid Bilal"), boxLocationNote (e.g. "2nd Floor
 *   White Gate") and dropWireCoreColor (e.g. "Blue/Orange"). They are
 *   edited on the customer profile form and shown on the profile view.
 *   Older records without them read back as empty — nothing is seeded,
 *   nothing is guessed, and no existing field is touched.
 * - A Zone Lineman Cheat-Sheet: one dashboard card + modal that lists
 *   customers grouped by Zone, sorted by pole/landmark, with Customer
 *   Name, Phone, Upstream House, Pole/Landmark and Media Converter
 *   status — plus a 1-click TXT export (download) and a copy button.
 *
 * Deliberate decisions, stated so a later reader does not have to guess:
 * - "Upstream House" is the SISP-7 feeder link: the name of the customer
 *   in upstreamCustomerId, or "Direct feed" when there is none (the same
 *   wording the profile feeder select uses). It is derived live, never
 *   stored twice.
 * - "Media Converter status" is the SISP-19 custody ownership label
 *   (ISP Owned — Returnable / Customer Purchased / Not recorded) plus a
 *   "Recovered <date>" suffix when the converter was marked recovered.
 * - The cheat-sheet lists NON-ARCHIVED customers only (archived = the
 *   app's disconnect action; the field list is for live drops). The modal
 *   says so in its intro line.
 * - "Zone" is the customer's saved zone field. Blank zones group under
 *   "Zone not recorded". Within a zone, rows sort by pole/landmark
 *   (blank landmarks last), then by name — so a lineman walks the
 *   street in pole order.
 * - No new store, no new backup section: the three fields live on the
 *   customer record, so they travel with the existing validated JSON
 *   backup (explicitly listed in core.js validation + merge, like the
 *   SISP-19 custody fields).
 *
 * Pure functions only, except setupPoleLandmarkModal (DOM wiring, null
 * when the dialog is absent so Node tests can import this module). The
 * only import is custodyOwnershipLabel from hardware-custody.js, which is
 * itself pure and import-free. Tests use synthetic data only.
 */

import { custodyOwnershipLabel } from './hardware-custody.js';

export const ZONE_NOT_RECORDED = 'Zone not recorded';

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
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

/** The three SISP-32 fields, trimmed, defaulting to '' on old records. */
export function normalizePoleFields(customer) {
  const source = customer && typeof customer === 'object' ? customer : {};
  return {
    poleNumber: cleanText(source.poleNumber),
    boxLocationNote: cleanText(source.boxLocationNote),
    dropWireCoreColor: cleanText(source.dropWireCoreColor)
  };
}

/** "Pole #14 near Masjid Bilal" or "Not recorded" for an empty record. */
export function poleLandmarkDisplay(customer) {
  const fields = normalizePoleFields(customer);
  if (fields.poleNumber) return fields.poleNumber;
  if (fields.boxLocationNote) return fields.boxLocationNote;
  return 'Not recorded';
}

/** SISP-19 ownership label + recovery suffix for the media converter. */
export function converterStatus(customer) {
  const source = customer && typeof customer === 'object' ? customer : {};
  const label = custodyOwnershipLabel(source.mediaConverterOwnership);
  const recovered = source.hardwareRecovered && typeof source.hardwareRecovered === 'object'
    ? source.hardwareRecovered.mediaConverter
    : null;
  return recovered ? `${label} · Recovered ${recovered}` : label;
}

/** SISP-7 feeder link resolved to a house name, or "Direct feed". */
export function upstreamHouseName(customers, customer) {
  const list = Array.isArray(customers) ? customers : [];
  const upstreamId = customer && typeof customer === 'object' ? cleanText(customer.upstreamCustomerId) : '';
  if (!upstreamId) return 'Direct feed';
  const upstream = list.find((c) => String(c.id) === upstreamId);
  return upstream && upstream.name ? upstream.name : 'Direct feed';
}

export function zoneLabel(customer) {
  const zone = customer && typeof customer === 'object' ? cleanText(customer.zone) : '';
  return zone || ZONE_NOT_RECORDED;
}

function comparePoleThenName(a, b) {
  const poleA = a.poleNumber;
  const poleB = b.poleNumber;
  if (poleA && !poleB) return -1;
  if (!poleA && poleB) return 1;
  if (poleA && poleB) {
    // Numeric-aware: "Pole #9" walks before "Pole #14" (plain string
    // order would put #14 first, which is wrong on a street).
    const byPole = poleA.localeCompare(poleB, undefined, { numeric: true, sensitivity: 'accent' });
    if (byPole !== 0) return byPole;
  }
  return a.name.localeCompare(b.name, undefined, { sensitivity: 'accent' });
}

/**
 * Build the cheat-sheet: [{ zone, rows }]. Rows carry exactly the spec
 * columns. Archived customers are excluded. zoneFilter 'all' keeps every
 * group; otherwise only the matching zone group is returned (including
 * ZONE_NOT_RECORDED). Groups sort alphabetically with ZONE_NOT_RECORDED
 * last; rows sort by pole/landmark, then name.
 */
export function buildCheatSheet(customers, zoneFilter = 'all') {
  const list = Array.isArray(customers) ? customers : [];
  const byZone = new Map();
  for (const customer of list) {
    if (!customer || customer.archived === true) continue;
    const zone = zoneLabel(customer);
    if (zoneFilter !== 'all' && zone !== zoneFilter) continue;
    const fields = normalizePoleFields(customer);
    const row = {
      customerId: customer.id,
      customerNumber: customer.customerNumber,
      name: customer.name || 'Unknown',
      phone: cleanText(customer.phone) || 'Not set',
      upstreamHouse: upstreamHouseName(list, customer),
      poleNumber: fields.poleNumber,
      boxLocationNote: fields.boxLocationNote,
      poleLandmark: fields.poleNumber || fields.boxLocationNote || 'Not recorded',
      dropWireCoreColor: fields.dropWireCoreColor || 'Not recorded',
      converterStatus: converterStatus(customer)
    };
    if (!byZone.has(zone)) byZone.set(zone, []);
    byZone.get(zone).push(row);
  }
  const groups = [...byZone.entries()].map(([zone, rows]) => ({
    zone,
    rows: rows.sort(comparePoleThenName)
  }));
  groups.sort((a, b) => {
    if (a.zone === ZONE_NOT_RECORDED) return 1;
    if (b.zone === ZONE_NOT_RECORDED) return -1;
    return a.zone.localeCompare(b.zone, undefined, { sensitivity: 'accent' });
  });
  return groups;
}

/** Sorted zone names present on non-archived customers (for the filter). */
export function cheatSheetZones(customers) {
  const list = Array.isArray(customers) ? customers : [];
  const zones = new Set();
  for (const customer of list) {
    if (!customer || customer.archived === true) continue;
    const zone = cleanText(customer.zone);
    if (zone) zones.add(zone);
  }
  return [...zones].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'accent' }));
}

/** Dashboard card numbers: live customers vs poles actually mapped. */
export function poleDirectorySummary(customers) {
  const list = Array.isArray(customers) ? customers : [];
  const live = list.filter((c) => c && c.archived !== true);
  const mapped = live.filter((c) => {
    const fields = normalizePoleFields(c);
    return fields.poleNumber !== '' || fields.boxLocationNote !== '';
  }).length;
  return { totalCustomers: live.length, mappedCount: mapped };
}

/** Plain-text export: one block per zone, one line per customer. */
export function cheatSheetText(groups) {
  const lines = ['Shahdara ISP — Zone Lineman Cheat-Sheet', ''];
  if (!Array.isArray(groups) || groups.length === 0) {
    lines.push('No customers in this zone.');
    return lines.join('\n');
  }
  for (const group of groups) {
    lines.push(`Zone: ${group.zone}`);
    if (group.rows.length === 0) {
      lines.push('  (none)');
    } else {
      group.rows.forEach((row, index) => {
        lines.push(`${index + 1}. ${row.name} (#${row.customerNumber}) — Phone: ${row.phone} — Upstream house: ${row.upstreamHouse} — Pole/Landmark: ${row.poleLandmark} — Box: ${row.boxLocationNote || 'Not recorded'} — Drop color: ${row.dropWireCoreColor} — Converter: ${row.converterStatus}`);
      });
    }
    lines.push('');
  }
  return lines.join('\n').trimEnd();
}

function downloadTextFile(filename, text) {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Dashboard modal wiring, mirroring setupMonthlyComplaintReportModal. The
 * dialog uses the shared .billing-modal styling (theme tokens, dark-mode
 * safe) and renders customers as labeled cards — never a wide table, so
 * nothing overflows at ≤480px. Returns { open, refresh } or null when the
 * dialog is absent (Node tests).
 */
export function setupPoleLandmarkModal(getState, { onToast } = {}) {
  const dialog = typeof document !== 'undefined' ? document.getElementById('poleLandmarkModal') : null;
  if (!dialog) return null;
  const $ = (id) => dialog.querySelector(`#${id}`);
  const closeBtn = $('poleCheatCloseBtn');
  if (closeBtn) closeBtn.addEventListener('click', () => dialog.close());

  const render = () => {
    const state = getState();
    const customers = state && Array.isArray(state.customers) ? state.customers : [];
    const zoneSelect = $('poleCheatZoneSelect');
    const zoneFilter = zoneSelect ? zoneSelect.value : 'all';
    const groups = buildCheatSheet(customers, zoneFilter);
    const summary = poleDirectorySummary(customers);
    const summaryEl = $('poleCheatSummaryLine');
    if (summaryEl) {
      summaryEl.textContent = `${summary.mappedCount} of ${summary.totalCustomers} customers have a pole or box note recorded. Archived customers are not listed.`;
    }
    const listEl = $('poleCheatList');
    if (listEl) {
      if (groups.length === 0) {
        listEl.innerHTML = '<p>No customers in this zone.</p>';
      } else {
        listEl.innerHTML = groups.map((group) => `<h3>Zone: ${escapeHtml(group.zone)}</h3>${group.rows.map((row) => `<article><p><strong>${escapeHtml(row.name)} (#${escapeHtml(String(row.customerNumber))})</strong></p><p>Phone: ${escapeHtml(row.phone)}</p><p>Upstream house: ${escapeHtml(row.upstreamHouse)}</p><p>Pole / landmark: ${escapeHtml(row.poleLandmark)}</p><p>Box location: ${escapeHtml(row.boxLocationNote || 'Not recorded')}</p><p>Drop wire color: ${escapeHtml(row.dropWireCoreColor)}</p><p>Media converter: ${escapeHtml(row.converterStatus)}</p></article>`).join('')}`).join('');
      }
    }
    const copyBtn = $('poleCheatCopyBtn');
    const downloadBtn = $('poleCheatDownloadBtn');
    const text = cheatSheetText(groups);
    if (copyBtn) {
      copyBtn.onclick = async () => {
        try {
          if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
            await navigator.clipboard.writeText(text);
            if (typeof onToast === 'function') onToast('Cheat-sheet copied.');
          } else if (typeof onToast === 'function') {
            onToast('Copy is not supported in this browser.');
          }
        } catch {
          if (typeof onToast === 'function') onToast('Could not copy the cheat-sheet.');
        }
      };
    }
    if (downloadBtn) {
      downloadBtn.onclick = () => {
        const zonePart = zoneFilter === 'all' ? 'all-zones' : zoneFilter.replace(/[^A-Za-z0-9-_]+/g, '-');
        downloadTextFile(`pole-cheat-sheet-${zonePart}.txt`, text);
        if (typeof onToast === 'function') onToast('Cheat-sheet downloaded.');
      };
    }
  };

  const zoneSelect = $('poleCheatZoneSelect');
  const fillZones = () => {
    if (!zoneSelect) return;
    const state = getState();
    const customers = state && Array.isArray(state.customers) ? state.customers : [];
    const current = zoneSelect.value;
    const zones = cheatSheetZones(customers);
    zoneSelect.innerHTML = '<option value="all">All zones</option>' + zones.map((zone) => `<option value="${escapeHtml(zone)}">${escapeHtml(zone)}</option>`).join('') + `<option value="${escapeHtml(ZONE_NOT_RECORDED)}">${escapeHtml(ZONE_NOT_RECORDED)}</option>`;
    zoneSelect.value = zones.includes(current) || current === 'all' || current === ZONE_NOT_RECORDED ? current : 'all';
  };
  if (zoneSelect) zoneSelect.addEventListener('change', render);
  const open = () => { fillZones(); render(); dialog.showModal(); };
  const openBtn = typeof document !== 'undefined' ? document.getElementById('openPoleLandmarkModalBtn') : null;
  if (openBtn) openBtn.addEventListener('click', open);
  return {
    open,
    refresh: () => { fillZones(); render(); }
  };
}
