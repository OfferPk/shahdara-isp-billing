/**
 * signal-history.js — OWNER-SIGNAL (owner feature, requested by ALEX
 * 2026-10-30): per-customer optical RX signal (dBm) reading history,
 * complaint before/after signal, and the per-mohalla average signal view.
 *
 * Owner's words, in essence: "Har profile mai signal kitnay dBm aa raha
 * hai woh manually likha ja sakay. Jab complaint ho to check kiya ja
 * sakay signal kitna tha aur fix ke baad kitna hua. Aur tamam mohallon
 * ke customers ke signals se har mohalla ka average signal nikaly."
 *
 * FOUNDATION (SISP-24, not forked): the customer record already carries
 * splitterBoxId / splitterPort / oltPonPort / lastRxDbm, validated in
 * core.js by checkRxDbm (finite, -60..+10 dBm, rounded to 1 decimal).
 * This module EXTENDS that: lastRxDbm stays the ONE current-signal
 * field, and every measurement that sets it is also journalled into
 * the append-only history below, so the two can never disagree.
 *
 * Storage: customer.signalReadings — absent-by-default list of
 *   { id 'SR-101+', date 'YYYY-MM-DD' (PKT entry date), dbm,
 *     source: 'manual' | 'install' | 'complaint-before' | 'complaint-after',
 *     complaintId (ticket id, complaint sources only), note }
 * Sanitized at the core.js choke points (readState, backup validate,
 * backup merge union-by-id — the SISP-28 relocation precedent), so
 * readings travel inside JSON backups with the customer. Capped at the
 * newest SIGNAL_READINGS_CAP entries per customer: appending beyond the
 * cap drops the OLDEST readings (stated here, never silent).
 *
 * SYNC RULE (one rule, every writer): after any append, lastRxDbm is
 * re-derived as the newest reading's dbm (newest by entry date, then id
 * sequence). Clearing lastRxDbm in a form appends NOTHING — an erased
 * value is not a measurement. Legacy records may hold a lastRxDbm with
 * no history (SISP-24 era): it stays the current signal, its date is
 * simply unknown (null), never invented.
 *
 * Signal is physical, not billing: FREE connections carry readings
 * exactly like paying ones, and nothing here touches bills, dues or the
 * billing engine. Archived customers keep their history on the record
 * but are excluded from the area report (current-network view).
 *
 * This module imports only phase3.js (canonicalMohalla), splitter-map.js
 * (the one weak-signal threshold/rule) and nav-language.js (t) — core.js
 * imports sanitizeSignalReadings from here, and none of those three
 * import core.js, so there is no cycle. Tests use synthetic data only.
 */

import { canonicalMohalla } from './phase3.js';
import { rxSignalStatus } from './splitter-map.js';
import { t } from './nav-language.js';

export const SIGNAL_READING_SOURCES = Object.freeze(['manual', 'install', 'complaint-before', 'complaint-after']);
export const SIGNAL_READINGS_CAP = 100;
export const SIGNAL_READING_NOTE_MAX = 200;

const SIGNAL_ID_RE = /^SR-(\d+)$/;
const SIGNAL_REF_RE = /^[A-Za-z]+-\d+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const PAKISTAN_TIME_ZONE = 'Asia/Karachi';

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

/** PKT calendar date (YYYY-MM-DD) for a reference instant — mirrors core.js dateKey. */
export function pakistanSignalDate(referenceDate = new Date()) {
  const date = referenceDate instanceof Date && !Number.isNaN(referenceDate.getTime())
    ? referenceDate
    : new Date();
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    year: 'numeric', month: '2-digit', day: '2-digit', timeZone: PAKISTAN_TIME_ZONE
  }).formatToParts(date).filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function round1(n) {
  return Math.round(n * 10) / 10;
}

/**
 * Throwing dBm validation — an EXACT mirror of core.js checkRxDbm
 * (SISP-24): '' / null / undefined → null (not recorded); otherwise the
 * value must be finite and inside -60..+10 dBm, rounded to 1 decimal.
 */
export function validateSignalDbm(value) {
  if (value === '' || value === null || value === undefined) return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < -60 || number > 10) throw new Error('Optical RX signal must be between -60 and 10 dBm.');
  return round1(number);
}

/** Non-throwing twin for sanitizers: a valid reading, or null. */
export function sanitizeSignalDbm(value) {
  if (value === '' || value === null || value === undefined) return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < -60 || number > 10) return null;
  return round1(number);
}

function compareReadings(a, b) {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  const na = Number(SIGNAL_ID_RE.exec(a.id)?.[1] ?? 0);
  const nb = Number(SIGNAL_ID_RE.exec(b.id)?.[1] ?? 0);
  return na - nb;
}

function capReadings(readings) {
  const sorted = [...readings].sort(compareReadings);
  return sorted.length > SIGNAL_READINGS_CAP ? sorted.slice(sorted.length - SIGNAL_READINGS_CAP) : sorted;
}

/** Next reading id: one above the highest existing SR-N, starting at SR-101. */
export function nextSignalReadingId(existing) {
  let max = 100;
  for (const entry of (Array.isArray(existing) ? existing : [])) {
    if (!entry || typeof entry !== 'object') continue;
    const match = SIGNAL_ID_RE.exec(String(entry.id || ''));
    if (match) max = Math.max(max, Number(match[1]));
  }
  return `SR-${max + 1}`;
}

/**
 * Sanitize one readings list: malformed entries (bad id, bad date, or a
 * dbm outside the SISP-24 range) are dropped; an unknown source falls
 * back to 'manual' (the measurement itself is real); complaintId is
 * kept only for the complaint sources and only when it looks like a
 * record id (TKT-101 / CMP-101). Deduped by id (first copy wins),
 * sorted oldest → newest, capped at the newest SIGNAL_READINGS_CAP.
 */
export function sanitizeSignalReadings(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const out = [];
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue;
    const id = cleanText(entry.id);
    if (!SIGNAL_ID_RE.test(id) || seen.has(id)) continue;
    const date = cleanText(entry.date);
    if (!DATE_RE.test(date)) continue;
    const dbm = sanitizeSignalDbm(entry.dbm);
    if (dbm === null) continue;
    seen.add(id);
    const source = SIGNAL_READING_SOURCES.includes(entry.source) ? entry.source : 'manual';
    const ref = cleanText(entry.complaintId);
    out.push({
      id,
      date,
      dbm,
      source,
      complaintId: (source === 'complaint-before' || source === 'complaint-after') && SIGNAL_REF_RE.test(ref) ? ref : '',
      note: cleanText(entry.note).slice(0, SIGNAL_READING_NOTE_MAX)
    });
  }
  return capReadings(out);
}

/**
 * Build one validated reading. dbm is REQUIRED here (a history entry
 * without a measurement is meaningless) and validated exactly like
 * SISP-24's checkRxDbm. The entry date defaults to today (PKT); an
 * explicit valid YYYY-MM-DD date is honoured (backfilled field notes).
 */
export function buildSignalReading(input, existing, referenceDate = new Date()) {
  const dbm = validateSignalDbm(input?.dbm);
  if (dbm === null) throw new Error('Enter the signal reading in dBm first.');
  const source = SIGNAL_READING_SOURCES.includes(input?.source) ? input.source : 'manual';
  const rawDate = cleanText(input?.date);
  const ref = cleanText(input?.complaintId);
  return {
    id: nextSignalReadingId(existing),
    date: DATE_RE.test(rawDate) ? rawDate : pakistanSignalDate(referenceDate),
    dbm,
    source,
    complaintId: (source === 'complaint-before' || source === 'complaint-after') && SIGNAL_REF_RE.test(ref) ? ref : '',
    note: cleanText(input?.note).slice(0, SIGNAL_READING_NOTE_MAX)
  };
}

/** The newest reading on a customer (by entry date, then id), or null. */
export function latestSignalReading(customer) {
  const readings = sanitizeSignalReadings(customer?.signalReadings);
  return readings.length ? readings[readings.length - 1] : null;
}

/** History rows for display: newest first, each with its weak flag. */
export function signalReadingsNewestFirst(customer) {
  return sanitizeSignalReadings(customer?.signalReadings)
    .map((reading) => ({ ...reading, weak: rxSignalStatus(reading.dbm) === 'weak' }))
    .reverse();
}

/**
 * Append one reading to a customer (PURE — returns a new customer) and
 * re-derive lastRxDbm from the newest reading, keeping the SISP-24
 * current-signal field and this history in lock-step.
 */
export function appendSignalReading(customer, input, referenceDate = new Date()) {
  if (!customer || typeof customer !== 'object') throw new Error('Customer not found.');
  const readings = sanitizeSignalReadings(customer.signalReadings);
  const reading = buildSignalReading(input, readings, referenceDate);
  const next = capReadings([...readings, reading]);
  const latest = next.length ? next[next.length - 1] : null;
  return {
    ...customer,
    signalReadings: next,
    lastRxDbm: latest ? latest.dbm : (customer.lastRxDbm ?? null)
  };
}

/**
 * Area (mohalla) signal report — PURE. Groups ACTIVE (non-archived)
 * customers by canonicalMohalla (the phase3 grouping SISP-129 / Area
 * Intelligence use; spelling variants of one mohalla merge, and a
 * non-canonical stored area keeps its own group under its stored name).
 * Each customer's contribution is their CURRENT signal: lastRxDbm, or —
 * for a record whose current field was cleared while history exists —
 * the newest reading's dbm. The reading date is the newest reading's
 * date when that reading backs the current value, else null (a legacy
 * SISP-24 reading whose date was never recorded). Customers without
 * any reading count toward totalCustomers but NEVER toward the average.
 * Rows are weakest-signal first so the worst drops surface on top.
 * Groups sort by average (weakest first); groups with no readings go
 * last, honestly showing a null average.
 */
export function buildAreaSignalReport(state) {
  const customers = Array.isArray(state?.customers) ? state.customers : [];
  const groups = new Map();
  for (const customer of customers) {
    if (!customer || typeof customer !== 'object') continue;
    if (customer.archived === true) continue;
    const canon = canonicalMohalla(customer.mohalla ?? '');
    const key = canon ? canon.key : '';
    if (!groups.has(key)) {
      groups.set(key, { areaKey: key, area: canon ? canon.label : null, withReadings: [], readingsCount: 0, totalCustomers: 0, sum: 0 });
    }
    const group = groups.get(key);
    group.totalCustomers += 1;
    const latest = latestSignalReading(customer);
    const current = sanitizeSignalDbm(customer.lastRxDbm);
    const dbm = current !== null ? current : (latest ? latest.dbm : null);
    if (dbm === null) continue;
    const date = latest && latest.dbm === dbm ? latest.date : null;
    group.withReadings.push({
      customerId: customer.id ?? null,
      name: customer.name ?? '',
      customerNumber: customer.customerNumber ?? null,
      dbm,
      date
    });
    group.readingsCount += 1;
    group.sum += dbm;
  }
  const report = [...groups.values()].map((group) => ({
    areaKey: group.areaKey,
    area: group.area,
    withReadings: [...group.withReadings].sort((a, b) => (a.dbm - b.dbm) || ((a.customerNumber ?? 0) - (b.customerNumber ?? 0))),
    averageDbm: group.readingsCount ? round1(group.sum / group.readingsCount) : null,
    readingsCount: group.readingsCount,
    totalCustomers: group.totalCustomers
  }));
  report.sort((a, b) => {
    if (a.averageDbm === null && b.averageDbm === null) return String(a.area ?? '').localeCompare(String(b.area ?? ''));
    if (a.averageDbm === null) return 1;
    if (b.averageDbm === null) return -1;
    if (a.averageDbm !== b.averageDbm) return a.averageDbm - b.averageDbm;
    return String(a.area ?? '').localeCompare(String(b.area ?? ''));
  });
  return report;
}

function formatSignalDate(date) {
  if (!date) return '';
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeZone: PAKISTAN_TIME_ZONE }).format(new Date(`${date}T00:00:00Z`));
  } catch {
    return date;
  }
}

/**
 * Area Signal modal controller (splitter-map pattern): a read-only view
 * over buildAreaSignalReport — one expandable block per mohalla with
 * the big average, the "X of Y customers have readings" count, and the
 * weakest-first customer rows with their reading dates, so an old
 * measurement is visible as old. Rendering never mutates state.
 */
export function setupAreaSignalModal(getState, { onToast } = {}) {
  const dialog = typeof document !== 'undefined' ? document.getElementById('areaSignalModal') : null;
  if (!dialog) return null;
  const $ = (id) => dialog.querySelector(`#${id}`);

  function render() {
    const title = $('areaSignalModalTitle');
    if (title) title.textContent = t('sig_area_title');
    const intro = $('areaSignalIntro');
    if (intro) intro.textContent = t('sig_area_intro');
    const listEl = $('areaSignalList');
    if (!listEl) return;
    const report = buildAreaSignalReport(typeof getState === 'function' ? getState() : {});
    if (!report.length) {
      listEl.innerHTML = `<p class="area-signal-empty">${escapeHtml(t('sig_area_empty'))}</p>`;
      return;
    }
    listEl.innerHTML = report.map((group, index) => {
      const areaName = group.area ?? t('sig_area_not_set');
      const average = group.averageDbm === null
        ? `<strong class="area-signal-average area-signal-average-none">${escapeHtml(t('sig_area_none'))}</strong>`
        : `<strong class="area-signal-average">${escapeHtml(t('sig_area_average', null, { avg: group.averageDbm.toFixed(1) }))}</strong>`;
      const rows = group.withReadings.map((row) => {
        const weak = rxSignalStatus(row.dbm) === 'weak'
          ? ` <span class="safety-badge badge-danger">${escapeHtml(t('sig_weak_badge'))}</span>`
          : '';
        const date = row.date ? ` · ${escapeHtml(formatSignalDate(row.date))}` : '';
        return `<li class="area-signal-row"><span>#${escapeHtml(String(row.customerNumber ?? ''))} ${escapeHtml(row.name || '')}</span><strong>${escapeHtml(String(row.dbm))} dBm</strong>${weak}<small>${date}</small></li>`;
      }).join('');
      return `<details class="area-signal-group" ${index === 0 && group.averageDbm !== null ? 'open' : ''}>
        <summary class="area-signal-summary"><span class="area-signal-name">${escapeHtml(areaName)}</span>${average}<small>${escapeHtml(t('sig_area_counts', null, { with: group.readingsCount, total: group.totalCustomers }))}</small></summary>
        ${rows ? `<ul class="area-signal-rows">${rows}</ul>` : `<p class="area-signal-norows">${escapeHtml(t('sig_area_none'))}</p>`}
      </details>`;
    }).join('');
  }

  const closeBtn = $('areaSignalCloseBtn');
  if (closeBtn) closeBtn.addEventListener('click', () => dialog.close());
  const openBtn = typeof document !== 'undefined' ? document.getElementById('openAreaSignalModalBtn') : null;
  if (openBtn) openBtn.addEventListener('click', () => { render(); dialog.showModal(); });

  return {
    open() { render(); dialog.showModal(); },
    refresh: render
  };
}
