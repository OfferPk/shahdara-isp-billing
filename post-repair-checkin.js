/**
 * post-repair-checkin.js — SISP-104: 24h Post-Repair Customer
 * Satisfaction Check-In Queue.
 *
 * Problem: a complaint gets fixed and forgotten — nobody asks the
 * customer, a day later, whether the connection is actually still
 * working. A repair that silently failed comes back as an angrier
 * second complaint. This module is the follow-up queue: complaints
 * resolved 24–48 hours ago that have not been checked on yet, each
 * with a 1-tap WhatsApp check-in that stamps followUpSentAt on the
 * complaint record.
 *
 * Ownership: the follow-up lives on the SISP-15 COMPLAINT record
 * (complaint-register.js). The complaint is the customer-facing
 * record of the fault — a SISP-12 ticket is only the field work
 * order that syncs into it (complaint-ticket-sync.js), so a
 * resolution counts however it arrived (direct or via ticket): the
 * queue reads only the complaint's own status + resolvedAt.
 *
 * Window: "resolved in the last 24–48 hours" is implemented as the
 * band [24h, 48h] of resolution age, inclusive at both ends. A
 * repair younger than 24h has not had a full day to prove itself
 * (the phase is the "24h check-in"), and past 48h the moment for a
 * satisfaction check has passed. Ages are computed on Pakistan
 * wall-clock strings ("YYYY-MM-DDTHH:MM", the register's own
 * format) parsed naively, so the result never depends on the
 * device's timezone. Complaints without a valid resolvedAt never
 * enter the queue — no resolution time is ever fabricated.
 *
 * Area-outage records (AREA_OUTAGE_CUSTOMER_ID) never enter the
 * queue: there is no single customer to message.
 *
 * The stamp is once-ever and historical: markPostRepairCheckinSent
 * refuses to move an existing stamp, and reopening a complaint in
 * the register never clears it — a complaint that was checked on
 * stays out of the queue even if it is later reopened and resolved
 * a second time.
 *
 * Sending follows the house wa.me DRAFT pattern: the tap builds the
 * draft URL via formatWhatsAppUrl and opens it; the owner presses
 * send in WhatsApp himself. The stamp is written only when the
 * draft actually opened (a blocked pop-up or an unusable number
 * leaves the complaint queued and unstamped).
 *
 * All helpers are pure except load/save via the register and the
 * modal setup. Tests use synthetic data only.
 */

import { t } from './nav-language.js';
import {
  AREA_OUTAGE_CUSTOMER_ID,
  complaintCustomerLabel,
  loadComplaints,
  pakistanDateTimeNow,
  saveComplaints
} from './complaint-register.js';
import { formatWhatsAppUrl } from './form-validation.js';

/** Check-in window: a resolution becomes due at 24h old... */
export const POST_REPAIR_CHECKIN_MIN_HOURS = 24;
/** ...and ages out of the queue at 48h old (both ends inclusive). */
export const POST_REPAIR_CHECKIN_MAX_HOURS = 48;

const DATE_TIME_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;
const HOUR_MS = 3600000;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
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
 * Parses a "YYYY-MM-DDTHH:MM" Pakistan wall-clock string to a naive
 * epoch (components read as UTC). Two strings parsed this way
 * differ by exactly their wall-clock difference — PKT has no DST —
 * so ages are timezone-proof. Returns null for anything malformed.
 */
export function parsePktDateTimeMs(value) {
  const match = DATE_TIME_RE.exec(String(value || ''));
  if (!match) return null;
  const [, year, month, day, hour, minute] = match.map(Number);
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) return null;
  return Date.UTC(year, month - 1, day, hour, minute);
}

/** True while no check-in has been sent for this complaint. */
export function isPostRepairCheckinPending(complaint) {
  if (!complaint || typeof complaint !== 'object') return false;
  return complaint.followUpSentAt === null
    || complaint.followUpSentAt === undefined
    || complaint.followUpSentAt === '';
}

/**
 * The check-in queue: complaints Resolved with a valid resolvedAt
 * whose age at referenceDate sits inside the [24h, 48h] band and
 * whose followUpSentAt is still null. Oldest resolution first (it
 * ages out soonest). Pure: the input list is never mutated.
 * Returns [{ complaint, resolvedAt, ageHours }].
 */
export function buildPostRepairCheckinQueue(complaints, referenceDate = new Date()) {
  const nowMs = parsePktDateTimeMs(pakistanDateTimeNow(referenceDate));
  if (nowMs === null) return [];
  const minMs = POST_REPAIR_CHECKIN_MIN_HOURS * HOUR_MS;
  const maxMs = POST_REPAIR_CHECKIN_MAX_HOURS * HOUR_MS;
  const out = [];
  for (const complaint of (Array.isArray(complaints) ? complaints : [])) {
    if (!complaint || typeof complaint !== 'object') continue;
    if (complaint.status !== 'Resolved') continue;
    if (!complaint.customerId || complaint.customerId === AREA_OUTAGE_CUSTOMER_ID) continue;
    if (!isPostRepairCheckinPending(complaint)) continue;
    const resolvedMs = parsePktDateTimeMs(complaint.resolvedAt);
    if (resolvedMs === null) continue;
    const ageMs = nowMs - resolvedMs;
    if (ageMs < minMs || ageMs > maxMs) continue;
    out.push({
      complaint,
      resolvedAt: String(complaint.resolvedAt),
      ageHours: Math.round((ageMs / HOUR_MS) * 100) / 100
    });
  }
  return out.sort((a, b) => a.resolvedAt.localeCompare(b.resolvedAt));
}

/**
 * The WhatsApp check-in message for one complaint, in the app's
 * current language (en = Roman Urdu working text, ur = Urdu script).
 */
export function buildPostRepairCheckinMessage(complaint, lang = null) {
  if (!complaint || typeof complaint !== 'object') return '';
  return t('prc_msg_checkin', lang, {
    name: complaintCustomerLabel(complaint),
    id: String(complaint.id || ''),
    category: String(complaint.issueCategory || '')
  });
}

/**
 * Stamps followUpSentAt (Pakistan wall-clock "YYYY-MM-DDTHH:MM") on
 * one complaint. Returns a NEW list. Idempotent: an already-stamped
 * complaint keeps its original stamp untouched — the stamp records
 * the first (and only) check-in. Throws on an unknown id.
 */
export function markPostRepairCheckinSent(list, id, referenceDate = new Date()) {
  const next = clone(Array.isArray(list) ? list : []);
  const entry = next.find((c) => c && c.id === id);
  if (!entry) throw new Error(`Complaint not found: ${id}.`);
  if (!isPostRepairCheckinPending(entry)) return next;
  entry.followUpSentAt = pakistanDateTimeNow(referenceDate);
  return next;
}

/**
 * Wires the post-repair check-in modal (dialog in index.html). Pure
 * logic lives above; this controller only renders and persists via
 * the register's load/save + the host's onComplaintsChanged.
 */
export function setupPostRepairCheckinModal(getState, { onToast, onComplaintsChanged } = {}) {
  const dialog = typeof document !== 'undefined' ? document.getElementById('postRepairCheckinModal') : null;
  if (!dialog) return null;
  const $ = (id) => dialog.querySelector(`#${id}`);
  const toast = typeof onToast === 'function' ? onToast : () => {};

  function customerFor(complaint) {
    const state = getState() || { customers: [] };
    return (Array.isArray(state.customers) ? state.customers : [])
      .find((c) => c && String(c.id) === String(complaint.customerId)) || null;
  }

  function render() {
    const listEl = $('postRepairCheckinList');
    if (!listEl) return;
    const queue = buildPostRepairCheckinQueue(loadComplaints());
    const summaryEl = $('postRepairCheckinSummaryLine');
    if (summaryEl) {
      summaryEl.textContent = queue.length === 0
        ? t('prc_summary_none')
        : t('prc_summary_count', null, { count: queue.length });
    }
    if (queue.length === 0) {
      listEl.innerHTML = `<p class="post-repair-checkin-empty">${escapeHtml(t('prc_empty'))}</p>`;
      return;
    }
    listEl.innerHTML = queue.map(({ complaint, resolvedAt, ageHours }) => {
      const customer = customerFor(complaint);
      const phone = customer && typeof customer.phone === 'string' ? customer.phone.trim() : '';
      const action = phone
        ? `<button type="button" class="primary-button post-repair-checkin-send-btn" data-prc-send="${escapeHtml(complaint.id)}">${escapeHtml(t('prc_send_btn'))}</button>`
        : `<p class="post-repair-checkin-nomobile">${escapeHtml(t('prc_no_mobile'))}</p>`;
      return `
      <article class="post-repair-checkin-card" data-prc-id="${escapeHtml(complaint.id)}">
        <header class="post-repair-checkin-head">
          <strong>${escapeHtml(complaint.id)}</strong>
          <span class="post-repair-checkin-age">${escapeHtml(t('prc_age_hours', null, { age: Math.floor(ageHours) }))}</span>
        </header>
        <p><span>${escapeHtml(t('prc_field_customer'))}</span><strong>${escapeHtml(complaintCustomerLabel(complaint))}</strong></p>
        <p><span>${escapeHtml(t('prc_field_issue'))}</span><strong>${escapeHtml(complaint.issueCategory || '')}</strong></p>
        <p><span>${escapeHtml(t('prc_field_resolved'))}</span><strong>${escapeHtml(resolvedAt.replace('T', ' '))}</strong></p>
        <div class="post-repair-checkin-actions">${action}</div>
      </article>`;
    }).join('');
  }

  const listEl = $('postRepairCheckinList');
  if (listEl) {
    listEl.addEventListener('click', (event) => {
      const btn = event.target.closest('[data-prc-send]');
      if (!btn) return;
      const id = btn.dataset.prcSend;
      const complaints = loadComplaints();
      const complaint = complaints.find((c) => c.id === id);
      if (!complaint) { render(); return; }
      const customer = customerFor(complaint);
      const message = buildPostRepairCheckinMessage(complaint);
      const res = formatWhatsAppUrl(customer ? (customer.phone || '') : '', message);
      if (!res.validPhone || !res.url) {
        toast(t('prc_send_failed_toast'));
        return;
      }
      const win = typeof window !== 'undefined' ? window.open(res.url, '_blank') : null;
      if (!win) {
        // The draft never opened, so nothing was sent: leave the
        // complaint queued and unstamped for the next attempt.
        toast(t('prc_send_failed_toast'));
        return;
      }
      try {
        const next = markPostRepairCheckinSent(complaints, id);
        saveComplaints(next);
        if (typeof onComplaintsChanged === 'function') onComplaintsChanged(next);
        toast(t('prc_sent_toast', null, { id }));
      } catch (error) {
        toast(error && error.message ? error.message : t('prc_send_failed_toast'));
      }
      render();
    });
  }

  const closeBtn = $('postRepairCheckinCloseBtn');
  if (closeBtn) closeBtn.addEventListener('click', () => dialog.close());
  const openBtn = typeof document !== 'undefined' ? document.getElementById('openPostRepairCheckinModalBtn') : null;
  if (openBtn) openBtn.addEventListener('click', () => {
    render();
    dialog.showModal();
  });

  return {
    open() {
      render();
      dialog.showModal();
    },
    refresh: render
  };
}
