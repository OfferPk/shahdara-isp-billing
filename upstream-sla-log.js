/**
 * upstream-sla-log.js — SISP-117: Upstream Provider (Main Uplink /
 * NayaPay Down) Outage SLA & Rebate Claim Log.
 *
 * Problem: when the upstream provider's main uplink (or its NayaPay
 * collection rail) goes down, the whole network suffers — but the hours
 * were never totalled anywhere, so the owner had no evidence pack for
 * an SLA rebate claim against the upstream bandwidth bill. This module
 * builds that claim log from the SISP-15 complaint register for one
 * selected month: every upstream incident with its timestamps, the
 * total uplink downtime, the month's upstream availability %, and a
 * suggested pro-rata rebate against the recorded bandwidth bill.
 *
 * Category (REAL recorded value, no invention): the register's own
 * COMPLAINT_CATEGORIES list (complaint-register.js) already carries
 * exactly one upstream category — 'Main Uplink / NayaPay Down' — and
 * the sanitizer coerces anything else to 'Other', so filtering on that
 * exact string matches every record that can ever exist. Nothing is
 * renamed and no new category is invented.
 *
 * Duration rule (SISP-16 precedent, downtime-analytics.js): the
 * incident's duration is the register's own stored `downtimeHours` —
 * the value the register auto-computed from reportedAt → resolvedAt
 * (or the operator's manual override, which therefore always wins).
 * When a Resolved record somehow carries no stored hours, the
 * register's own computeDowntimeHours(reportedAt, resolvedAt) is the
 * fallback — still only recorded fields. An incident with no recorded
 * resolution (Open / In Progress, or no resolvedAt) is UNMEASURED: it
 * is listed as ongoing and contributes 0 hours, never an invented
 * figure measured to "now" (SISP-16 counts unresolved as 0 hours).
 * Overlaps are summed per incident, exactly like SISP-16 — the two
 * analytics views can therefore never disagree about a month's hours.
 *
 * Month membership mirrors SISP-15/16: an incident belongs to the
 * month of its reportedAt (YYYY-MM). Month hours are the real calendar
 * hours of that month (days × 24). Availability % =
 * (monthHours − totalDowntime) / monthHours × 100, rounded to 2
 * decimals (the register's downtime rounding) and never below 0.
 *
 * Rebate base (SISP-27, fixed-overheads.js — read, never hardcoded):
 * the month's recorded upstream bandwidth amount, most specific first:
 * (1) the live posting for the 'upstream-bandwidth' template in that
 * month (overheadPostingFor — a posting whose expense was deleted is
 * stale and does not count), else (2) the template's recorded default
 * amount (resolveOverheadTemplates). When neither exists the rebate is
 * UNAVAILABLE (null) — a base is never fabricated. Suggested rebate =
 * Math.round(bandwidthBill × totalDowntimeHours / monthHours) — whole
 * rupees, the SISP-30 concession suggestion's rounding.
 *
 * READ-ONLY by construction: the builders never write storage, never
 * post an expense/credit and never touch an overhead record; the modal
 * only reads loadComplaints()/loadOverheads() and exports a CSV.
 *
 * This module is imported ONLY by app.js (app.js-only import seam), so
 * the dist bundle stays at the #219 budget of 25 files. Tests use
 * synthetic data only.
 */

import { t } from './nav-language.js';
import {
  complaintCustomerLabel,
  computeDowntimeHours,
  loadComplaints,
  pakistanMonthNow
} from './complaint-register.js';
import {
  UPSTREAM_TEMPLATE_ID,
  loadOverheads,
  overheadPostingFor,
  resolveOverheadTemplates
} from './fixed-overheads.js';
import { generateCsvContent, downloadCsvFile } from './form-validation.js';

/** The register's one real upstream category (see header). */
export const UPSTREAM_SLA_CATEGORY = 'Main Uplink / NayaPay Down';

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

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

function round2(value) {
  return Math.round(value * 100) / 100;
}

/** Real calendar hours in a YYYY-MM month (days × 24); null when invalid. */
export function monthHoursFor(month) {
  if (!MONTH_RE.test(String(month || ''))) return null;
  const [year, monthNumber] = String(month).split('-').map(Number);
  const days = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return days * 24;
}

/**
 * One incident's downtime in hours from recorded fields only (see the
 * header's duration rule). Returns null when the incident is unmeasured
 * (no recorded resolution yet) — never an invented number.
 */
export function upstreamIncidentDurationHours(complaint) {
  const raw = complaint?.downtimeHours;
  if (raw !== null && raw !== undefined && raw !== '') {
    const stored = Number(raw);
    if (Number.isFinite(stored) && stored >= 0) return round2(stored);
  }
  if (complaint?.status === 'Resolved') {
    return computeDowntimeHours(complaint?.reportedAt, complaint?.resolvedAt);
  }
  return null;
}

/**
 * The month's recorded upstream bandwidth bill (SISP-27 store), most
 * specific source first. Returns { amount, source, posting } with
 * amount null when nothing is recorded — never a fabricated base.
 */
export function resolveUpstreamBandwidthBill(overheadsData, state, month) {
  const posting = overheadPostingFor(overheadsData, state, UPSTREAM_TEMPLATE_ID, month);
  if (posting) return { amount: round2(posting.amount), source: 'posting', posting };
  const template = resolveOverheadTemplates(overheadsData)
    .find((row) => row.id === UPSTREAM_TEMPLATE_ID);
  if (template && template.defaultAmount !== null && template.defaultAmount !== undefined) {
    return { amount: round2(template.defaultAmount), source: 'default', posting: null };
  }
  return { amount: null, source: null, posting: null };
}

/**
 * The full claim log for one month. Pure and read-only: it reads the
 * given complaint list, the SISP-27 overheads object and the app state
 * (only so overheadPostingFor can tell a live posting from a stale
 * one) and mutates none of them.
 */
export function buildUpstreamSlaLog(complaints, overheadsData, state, month) {
  const validMonth = MONTH_RE.test(String(month || '')) ? String(month) : '';
  const monthHours = validMonth ? monthHoursFor(validMonth) : null;
  const incidents = (Array.isArray(complaints) ? complaints : [])
    .filter((c) => c && typeof c === 'object'
      && validMonth
      && c.issueCategory === UPSTREAM_SLA_CATEGORY
      && String(c.reportedAt || '').slice(0, 7) === validMonth)
    .map((c) => {
      const durationHours = upstreamIncidentDurationHours(c);
      return {
        id: cleanText(c.id),
        customerLabel: complaintCustomerLabel(c),
        zone: cleanText(c.zone),
        status: cleanText(c.status),
        reportedAt: cleanText(c.reportedAt),
        resolvedAt: cleanText(c.resolvedAt),
        durationHours,
        measured: durationHours !== null,
        resolutionNote: cleanText(c.resolutionNote)
      };
    })
    .sort((a, b) => String(a.reportedAt).localeCompare(String(b.reportedAt))
      || String(a.id).localeCompare(String(b.id)));
  const totalDowntimeHours = round2(
    incidents.reduce((sum, row) => sum + (row.measured ? row.durationHours : 0), 0)
  );
  const availabilityPct = monthHours
    ? round2(Math.max(0, ((monthHours - totalDowntimeHours) / monthHours) * 100))
    : null;
  const bandwidthBill = validMonth
    ? resolveUpstreamBandwidthBill(overheadsData, state, validMonth)
    : { amount: null, source: null, posting: null };
  const suggestedRebate = bandwidthBill.amount !== null && monthHours
    ? Math.round((bandwidthBill.amount * totalDowntimeHours) / monthHours)
    : null;
  return {
    month: validMonth,
    category: UPSTREAM_SLA_CATEGORY,
    incidents,
    incidentCount: incidents.length,
    measuredCount: incidents.filter((row) => row.measured).length,
    ongoingCount: incidents.filter((row) => !row.measured).length,
    totalDowntimeHours,
    monthHours,
    availabilityPct,
    bandwidthBill,
    suggestedRebate
  };
}

// CSV export — house filtered style (Billing Register precedent):
// English columns, a NOTE row describing the filtered view, and a
// `_filtered` filename. Serialized by form-validation's
// generateCsvContent so quoting/BOM match every other export.
export const UPSTREAM_SLA_CSV_HEADERS = [
  { key: 'id', label: 'Complaint ID' },
  { key: 'customer', label: 'Customer' },
  { key: 'zone', label: 'Zone' },
  { key: 'category', label: 'Category' },
  { key: 'reportedAt', label: 'Reported At' },
  { key: 'resolvedAt', label: 'Resolved At' },
  { key: 'durationHours', label: 'Downtime Hours' },
  { key: 'status', label: 'Status' },
  { key: 'resolutionNote', label: 'Resolution Note' }
];

export function upstreamSlaCsvRows(claim) {
  return (claim?.incidents ?? []).map((row) => ({
    id: row.id,
    customer: row.customerLabel,
    zone: row.zone,
    category: claim?.category ?? UPSTREAM_SLA_CATEGORY,
    reportedAt: row.reportedAt,
    resolvedAt: row.resolvedAt,
    durationHours: row.measured ? row.durationHours : '',
    status: row.status,
    resolutionNote: row.resolutionNote
  }));
}

export function upstreamSlaCsvNote(claim) {
  const bill = claim?.bandwidthBill?.amount === null || claim?.bandwidthBill?.amount === undefined
    ? 'not recorded'
    : `PKR ${claim.bandwidthBill.amount}`;
  const rebate = claim?.suggestedRebate === null || claim?.suggestedRebate === undefined
    ? 'unavailable'
    : `PKR ${claim.suggestedRebate}`;
  return `Note: Filtered view: upstream SLA claim log for ${claim?.month || ''} · ${claim?.incidentCount ?? 0} ${UPSTREAM_SLA_CATEGORY} incidents · ${claim?.totalDowntimeHours ?? 0} h total upstream downtime of ${claim?.monthHours ?? 0} h · availability ${claim?.availabilityPct ?? 0}% · bandwidth bill ${bill} · suggested rebate ${rebate}; suggestion only — nothing is posted automatically.`;
}

export function upstreamSlaCsvFilename(claim) {
  return `upstream-sla-claim-${claim?.month || 'month'}_filtered.csv`;
}

/** Full CSV text for a claim: NOTE row first, then one row per incident. */
export function buildUpstreamSlaCsv(claim) {
  const noteRow = {
    id: upstreamSlaCsvNote(claim),
    customer: '', zone: '', category: '', reportedAt: '', resolvedAt: '',
    durationHours: '', status: '', resolutionNote: ''
  };
  return generateCsvContent(UPSTREAM_SLA_CSV_HEADERS, [noteRow, ...upstreamSlaCsvRows(claim)]);
}

function displayTimestamp(value) {
  return String(value || '').replace('T', ' ');
}

/**
 * Wires the upstream SLA claim-log modal (dialog in index.html). Reads
 * the register + overheads fresh on every render so complaint or bill
 * changes show immediately. Read-only: the only action is CSV export.
 */
export function setupUpstreamSlaModal(getState, { onToast } = {}) {
  const dialog = typeof document !== 'undefined' ? document.getElementById('upstreamSlaModal') : null;
  if (!dialog) return null;
  const $ = (id) => dialog.querySelector(`#${id}`);
  let month = pakistanMonthNow();

  function currentClaim() {
    return buildUpstreamSlaLog(loadComplaints(), loadOverheads(), getState(), month);
  }

  function render() {
    const claim = currentClaim();
    const summaryEl = $('upstreamSlaSummaryLine');
    if (summaryEl) {
      summaryEl.textContent = claim.incidentCount === 0
        ? t('upsla_summary_empty', null, { month: claim.month || month })
        : t('upsla_summary', null, {
          count: claim.incidentCount,
          hours: claim.totalDowntimeHours,
          pct: claim.availabilityPct,
          month: claim.month
        });
    }
    const totalsEl = $('upstreamSlaTotals');
    if (totalsEl) {
      const billValue = claim.bandwidthBill.amount === null
        ? t('upsla_bill_none')
        : `PKR ${claim.bandwidthBill.amount}`;
      const billSource = claim.bandwidthBill.source === 'posting'
        ? t('upsla_bill_source_posting')
        : claim.bandwidthBill.source === 'default'
          ? t('upsla_bill_source_default')
          : '';
      const rebateValue = claim.suggestedRebate === null
        ? t('upsla_rebate_unavailable')
        : `PKR ${claim.suggestedRebate}`;
      totalsEl.innerHTML = `
        <article class="upstream-sla-total-card">
          <p><span>${escapeHtml(t('upsla_total_downtime'))}</span><strong>${escapeHtml(String(claim.totalDowntimeHours))} h</strong><small>${escapeHtml(t('upsla_month_hours', null, { total: claim.monthHours ?? 0 }))}</small></p>
        </article>
        <article class="upstream-sla-total-card">
          <p><span>${escapeHtml(t('upsla_availability'))}</span><strong>${escapeHtml(claim.availabilityPct === null ? '—' : `${claim.availabilityPct}%`)}</strong></p>
        </article>
        <article class="upstream-sla-total-card">
          <p><span>${escapeHtml(t('upsla_bill_label'))}</span><strong>${escapeHtml(billValue)}</strong>${billSource ? `<small>${escapeHtml(billSource)}</small>` : ''}</p>
        </article>
        <article class="upstream-sla-total-card">
          <p><span>${escapeHtml(t('upsla_rebate_label'))}</span><strong>${escapeHtml(rebateValue)}</strong></p>
        </article>`;
    }
    const listEl = $('upstreamSlaIncidentList');
    if (listEl) {
      if (claim.incidents.length === 0) {
        listEl.innerHTML = `<p class="upstream-sla-empty">${escapeHtml(t('upsla_no_incidents'))}</p>`;
      } else {
        listEl.innerHTML = claim.incidents.map((row) => `
          <article class="upstream-sla-card">
            <p><span>${escapeHtml(row.id)}</span><strong>${escapeHtml(row.customerLabel)}</strong></p>
            <p><span>${escapeHtml(t('upsla_zone'))}</span><strong>${escapeHtml(row.zone || '—')}</strong></p>
            <p><span>${escapeHtml(t('upsla_reported'))}</span><strong>${escapeHtml(displayTimestamp(row.reportedAt) || '—')}</strong></p>
            <p><span>${escapeHtml(t('upsla_resolved'))}</span><strong>${escapeHtml(row.measured ? (displayTimestamp(row.resolvedAt) || '—') : t('upsla_ongoing'))}</strong></p>
            <p><span>${escapeHtml(t('upsla_duration'))}</span><strong>${escapeHtml(row.measured ? `${row.durationHours} h` : t('upsla_ongoing'))}</strong></p>
            ${row.resolutionNote ? `<p><span>${escapeHtml(t('upsla_note'))}</span><strong>${escapeHtml(row.resolutionNote)}</strong></p>` : ''}
          </article>`).join('');
      }
    }
  }

  const monthInput = $('upstreamSlaMonth');
  if (monthInput) {
    monthInput.value = month;
    monthInput.addEventListener('change', () => {
      month = monthInput.value || pakistanMonthNow();
      render();
    });
  }
  const exportBtn = $('upstreamSlaExportBtn');
  if (exportBtn) exportBtn.addEventListener('click', () => {
    const claim = currentClaim();
    const ok = downloadCsvFile(upstreamSlaCsvFilename(claim), buildUpstreamSlaCsv(claim));
    if (onToast) {
      onToast(ok
        ? t('upsla_export_done', null, { count: claim.incidentCount })
        : t('upsla_export_failed'));
    }
  });
  const closeBtn = $('upstreamSlaCloseBtn');
  if (closeBtn) closeBtn.addEventListener('click', () => dialog.close());
  const openBtn = typeof document !== 'undefined' ? document.getElementById('openUpstreamSlaModalBtn') : null;
  if (openBtn) openBtn.addEventListener('click', () => {
    month = pakistanMonthNow();
    if (monthInput) monthInput.value = month;
    render();
    dialog.showModal();
  });

  return {
    open(prefilter = {}) {
      if (MONTH_RE.test(String(prefilter.month || ''))) month = String(prefilter.month);
      if (monthInput) monthInput.value = month;
      render();
      dialog.showModal();
    },
    refresh: render
  };
}
