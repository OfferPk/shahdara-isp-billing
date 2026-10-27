/**
 * complaint-register.js — SISP-15: Centralized Monthly Complaint Register +
 * Resolution Timeline.
 *
 * Problem: complaints lived as scattered notes (or not at all) — no single
 * register of who reported what, when it was fixed, or how long the customer
 * was down. This module is that register: one ledger of complaints with a
 * resolution timeline (reported → in progress → resolved) and automatic
 * downtime math.
 *
 * Storage: complaint records live in localStorage under COMPLAINTS_KEY
 * (sisp_complaints_ledger_v1). Records additionally travel inside JSON
 * backups via the `settings.complaints` section (see core.js
 * createJsonBackup), under the same safe-merge rules as shop settlements.
 *
 * This module imports nothing from core.js on purpose: core.js imports
 * sanitizeComplaints from here for backup restore, and a core import here
 * would create a module cycle. PKT dates are small local helpers mirroring
 * core.js (Intl en-PK / Asia/Karachi).
 *
 * All helpers are pure except load/saveComplaints and the modal setup.
 * Tests use synthetic data only.
 */

export const COMPLAINTS_KEY = 'sisp_complaints_ledger_v1';

/** Sentinel customer id for main-line / zone-wide faults (no single customer). */
export const AREA_OUTAGE_CUSTOMER_ID = 'AREA_OUTAGE';

export const COMPLAINT_CATEGORIES = [
  'Fiber Cut',
  'Media Converter / Charger Off',
  'Fiber Splice Loss',
  'Router / Wi-Fi Config',
  'CAT6 / Connector Fault',
  'WAPDA / Power Outage',
  'Main Uplink / NayaPay Down',
  'Other'
];

export const COMPLAINT_STATUSES = ['Open', 'In Progress', 'Resolved'];

const PAKISTAN_TIME_ZONE = 'Asia/Karachi';
const DATE_TIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
const MONTH_RE = /^\d{4}-\d{2}$/;
const ID_RE = /^CMP-(\d+)$/;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

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

function zonedParts(date) {
  return Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: PAKISTAN_TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23'
    }).formatToParts(date).filter((part) => part.type !== 'literal').map((part) => [part.type, part.value])
  );
}

/** "YYYY-MM-DDTHH:MM" in Pakistan time — the datetime-local input format. */
export function pakistanDateTimeNow(referenceDate = new Date()) {
  const date = referenceDate instanceof Date && !Number.isNaN(referenceDate.getTime())
    ? referenceDate
    : new Date();
  const parts = zonedParts(date);
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

/** YYYY-MM in Pakistan time. */
export function pakistanMonthNow(referenceDate = new Date()) {
  return pakistanDateTimeNow(referenceDate).slice(0, 7);
}

/**
 * Downtime in hours between reportedAt and resolvedAt, rounded to 2 decimals
 * (so 10:00 → 14:30 is exactly 4.5, never 4.499999). Returns null when either
 * endpoint is missing/invalid, 0 when resolved precedes reported.
 */
export function computeDowntimeHours(reportedAt, resolvedAt) {
  if (!DATE_TIME_RE.test(String(reportedAt || '')) || !DATE_TIME_RE.test(String(resolvedAt || ''))) return null;
  const start = new Date(String(reportedAt)).getTime();
  const end = new Date(String(resolvedAt)).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  return Math.max(0, Math.round(((end - start) / 3600000) * 100) / 100);
}

export function formatDowntimeHours(hours) {
  if (hours === null || hours === undefined || hours === '') return 'Not resolved yet';
  const n = Number(hours);
  if (!Number.isFinite(n)) return 'Not resolved yet';
  return `${n} h`;
}

/** Next ticket id: one above the highest existing CMP-N, starting at CMP-101. */
export function nextComplaintId(existing) {
  let max = 100;
  for (const entry of (Array.isArray(existing) ? existing : [])) {
    if (!entry || typeof entry !== 'object') continue;
    const match = String(entry.id || '').match(ID_RE);
    if (match) max = Math.max(max, Number(match[1]));
  }
  return `CMP-${max + 1}`;
}

/**
 * Drops malformed complaint entries; keeps only known fields with safe
 * defaults so old records (missing new fields) never break the register.
 */
export function sanitizeComplaints(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue;
    const id = cleanText(entry.id);
    if (!id) continue;
    const status = COMPLAINT_STATUSES.includes(entry.status) ? entry.status : 'Open';
    const reportedAt = DATE_TIME_RE.test(String(entry.reportedAt || '')) ? String(entry.reportedAt) : '';
    const resolvedAt = DATE_TIME_RE.test(String(entry.resolvedAt || '')) ? String(entry.resolvedAt) : '';
    const downtime = Number(entry.downtimeHours);
    out.push({
      id,
      customerId: entry.customerId === AREA_OUTAGE_CUSTOMER_ID ? AREA_OUTAGE_CUSTOMER_ID : (entry.customerId ?? null),
      customerName: cleanText(entry.customerName),
      zone: cleanText(entry.zone),
      issueCategory: COMPLAINT_CATEGORIES.includes(entry.issueCategory) ? entry.issueCategory : 'Other',
      reportedAt,
      resolvedAt,
      downtimeHours: Number.isFinite(downtime) && downtime >= 0 ? downtime : null,
      downtimeManual: entry.downtimeManual === true,
      status,
      resolutionNote: cleanText(entry.resolutionNote),
      createdAt: typeof entry.createdAt === 'string' ? entry.createdAt : ''
    });
  }
  return out;
}

/** Reads complaint records; [] on missing/corrupt storage. */
export function loadComplaints(storage) {
  try {
    const store = storage || (typeof globalThis !== 'undefined' ? globalThis.localStorage : null);
    if (!store) return [];
    const raw = store.getItem(COMPLAINTS_KEY);
    if (!raw) return [];
    return sanitizeComplaints(JSON.parse(raw));
  } catch {
    return [];
  }
}

/** Persists complaint records; never throws. */
export function saveComplaints(complaints, storage) {
  try {
    const store = storage || (typeof globalThis !== 'undefined' ? globalThis.localStorage : null);
    if (!store) return false;
    store.setItem(COMPLAINTS_KEY, JSON.stringify(Array.isArray(complaints) ? complaints : []));
    return true;
  } catch {
    return false;
  }
}

/**
 * Builds a new complaint. Area outages pass customerId AREA_OUTAGE_CUSTOMER_ID
 * (customerName is stored as AREA_OUTAGE per spec; the UI renders it as
 * "Area outage"). reportedAt defaults to now and is editable afterwards.
 * Throws on a missing category or an area outage without a zone.
 */
export function createComplaint(input, existing, referenceDate = new Date()) {
  const category = COMPLAINT_CATEGORIES.includes(input?.issueCategory) ? input.issueCategory : null;
  if (!category) throw new Error('Pick an issue category for the complaint.');
  const isAreaOutage = input?.customerId === AREA_OUTAGE_CUSTOMER_ID || input?.areaOutage === true;
  const zone = cleanText(input?.zone);
  if (isAreaOutage && !zone) throw new Error('An area outage needs a zone.');
  const reportedAt = DATE_TIME_RE.test(String(input?.reportedAt || ''))
    ? String(input.reportedAt)
    : pakistanDateTimeNow(referenceDate);
  return {
    id: nextComplaintId(existing),
    customerId: isAreaOutage ? AREA_OUTAGE_CUSTOMER_ID : (input?.customerId ?? null),
    customerName: isAreaOutage ? AREA_OUTAGE_CUSTOMER_ID : cleanText(input?.customerName),
    zone,
    issueCategory: category,
    reportedAt,
    resolvedAt: '',
    downtimeHours: null,
    downtimeManual: false,
    status: 'Open',
    resolutionNote: cleanText(input?.resolutionNote),
    createdAt: new Date().toISOString()
  };
}

/** Display label for a complaint's customer: "Area outage · <zone>" for zone-wide faults. */
export function complaintCustomerLabel(complaint) {
  if (!complaint || typeof complaint !== 'object') return '';
  if (complaint.customerId === AREA_OUTAGE_CUSTOMER_ID) {
    return complaint.zone ? `Area outage · ${complaint.zone}` : 'Area outage';
  }
  return complaint.customerName || 'Unknown customer';
}

/**
 * Applies a status change. Resolving auto-fills resolvedAt (now, unless
 * given) and auto-computes downtime unless a manual override is on record.
 * Reopening clears resolvedAt/downtime so the timeline restarts cleanly;
 * the resolution note is kept as history. Returns a NEW list.
 */
export function setComplaintStatus(list, id, status, options = {}) {
  if (!COMPLAINT_STATUSES.includes(status)) throw new Error(`Unknown complaint status: ${status}.`);
  const next = clone(Array.isArray(list) ? list : []);
  const entry = next.find((c) => c && c.id === id);
  if (!entry) throw new Error(`Complaint not found: ${id}.`);
  entry.status = status;
  if (status === 'Resolved') {
    if (DATE_TIME_RE.test(String(options.resolvedAt || ''))) entry.resolvedAt = String(options.resolvedAt);
    else if (!entry.resolvedAt) entry.resolvedAt = pakistanDateTimeNow(options.referenceDate);
    if (typeof options.resolutionNote === 'string') entry.resolutionNote = cleanText(options.resolutionNote);
    if (!entry.downtimeManual) {
      const computed = computeDowntimeHours(entry.reportedAt, entry.resolvedAt);
      if (computed !== null) entry.downtimeHours = computed;
    }
  } else if (status === 'Open') {
    entry.resolvedAt = '';
    entry.downtimeHours = null;
    entry.downtimeManual = false;
  }
  return next;
}

/**
 * Inline edits for reportedAt, resolvedAt, downtimeHours, resolutionNote,
 * zone and category. Editing downtimeHours directly marks it a manual
 * override (later time edits no longer recompute it); editing a time
 * recomputes downtime for resolved complaints unless manually overridden.
 * Returns a NEW list.
 */
export function updateComplaint(list, id, patch) {
  const next = clone(Array.isArray(list) ? list : []);
  const entry = next.find((c) => c && c.id === id);
  if (!entry) throw new Error(`Complaint not found: ${id}.`);
  if (typeof patch !== 'object' || patch === null) return next;
  if (typeof patch.reportedAt === 'string' && DATE_TIME_RE.test(patch.reportedAt)) entry.reportedAt = patch.reportedAt;
  if (typeof patch.resolvedAt === 'string' && DATE_TIME_RE.test(patch.resolvedAt)) entry.resolvedAt = patch.resolvedAt;
  if (typeof patch.resolutionNote === 'string') entry.resolutionNote = cleanText(patch.resolutionNote);
  if (typeof patch.zone === 'string') entry.zone = cleanText(patch.zone);
  if (COMPLAINT_CATEGORIES.includes(patch.issueCategory)) entry.issueCategory = patch.issueCategory;
  if (patch.downtimeHours !== undefined && patch.downtimeHours !== null && patch.downtimeHours !== '') {
    const n = Number(patch.downtimeHours);
    if (Number.isFinite(n) && n >= 0) {
      entry.downtimeHours = Math.round(n * 100) / 100;
      entry.downtimeManual = true;
    }
  }
  if (entry.status === 'Resolved' && !entry.downtimeManual) {
    const computed = computeDowntimeHours(entry.reportedAt, entry.resolvedAt);
    if (computed !== null) entry.downtimeHours = computed;
  }
  return next;
}

/**
 * Register filters. Month matches the reported month (YYYY-MM); customer
 * matches customer id or name substring; zone/category match exactly.
 * Empty filter values mean "no filter".
 */
export function filterComplaints(list, filters = {}) {
  const month = MONTH_RE.test(String(filters.month || '')) ? String(filters.month) : '';
  const status = COMPLAINT_STATUSES.includes(filters.status) ? filters.status : '';
  const customer = cleanText(filters.customer);
  const zone = cleanText(filters.zone);
  const category = COMPLAINT_CATEGORIES.includes(filters.category) ? filters.category : '';
  return (Array.isArray(list) ? list : []).filter((c) => {
    if (!c || typeof c !== 'object') return false;
    if (month && String(c.reportedAt || '').slice(0, 7) !== month) return false;
    if (status && c.status !== status) return false;
    if (customer && String(c.customerId ?? '') !== customer && !String(c.customerName || '').toLowerCase().includes(customer.toLowerCase())) return false;
    if (zone && c.zone !== zone) return false;
    if (category && c.issueCategory !== category) return false;
    return true;
  });
}

/** Dashboard summary: open/in-progress/resolved counts + downtime totals. */
export function buildComplaintSummary(list, referenceDate = new Date()) {
  const all = Array.isArray(list) ? list : [];
  const month = pakistanMonthNow(referenceDate);
  const thisMonth = all.filter((c) => String(c.reportedAt || '').slice(0, 7) === month);
  const sumDowntime = (rows) => rows.reduce((sum, c) => sum + (Number.isFinite(Number(c.downtimeHours)) ? Number(c.downtimeHours) : 0), 0);
  return {
    month,
    total: all.length,
    open: all.filter((c) => c.status === 'Open').length,
    inProgress: all.filter((c) => c.status === 'In Progress').length,
    resolved: all.filter((c) => c.status === 'Resolved').length,
    thisMonthCount: thisMonth.length,
    thisMonthDowntime: Math.round(sumDowntime(thisMonth) * 100) / 100,
    totalDowntime: Math.round(sumDowntime(all) * 100) / 100
  };
}

/** Zones for the register filters: customer zones + known Shahdara zones, deduped. */
export function collectComplaintZones(state) {
  const known = ['Shahdara Town', 'Barrian', 'Palaliya', 'Chandall', 'Banii'];
  const zones = new Set(known);
  for (const customer of (state && Array.isArray(state.customers) ? state.customers : [])) {
    const zone = cleanText(customer?.zone);
    if (zone) zones.add(zone);
  }
  return [...zones].sort((a, b) => a.localeCompare(b));
}

/**
 * Wires the complaint register modal (dialog in index.html). Pure logic
 * lives above; this controller only renders and persists via load/save
 * + the app's onComplaintsChanged callback (dashboard + profile refresh).
 */
export function setupComplaintRegisterModal(getState, { onComplaintsChanged, onToast } = {}) {
  const dialog = typeof document !== 'undefined' ? document.getElementById('complaintRegisterModal') : null;
  if (!dialog) return null;
  const $ = (id) => dialog.querySelector(`#${id}`);
  const filters = { month: '', status: '', customer: '', zone: '', category: '' };

  function customerOptions() {
    const state = getState() || { customers: [] };
    return (Array.isArray(state.customers) ? state.customers : [])
      .filter((c) => c && !c.archived)
      .map((c) => ({ id: c.id, label: `#${c.customerNumber ?? ''} ${c.name || ''}`.trim() }));
  }

  function refreshFilterSelects() {
    const state = getState() || { customers: [] };
    const zones = collectComplaintZones(state);
    const zoneFilter = $('complaintFilterZone');
    if (zoneFilter) {
      const prev = filters.zone;
      zoneFilter.innerHTML = '<option value="">All zones</option>' + zones.map((z) => `<option value="${escapeHtml(z)}">${escapeHtml(z)}</option>`).join('');
      zoneFilter.value = zones.includes(prev) ? prev : '';
      filters.zone = zoneFilter.value;
    }
    const customerFilter = $('complaintFilterCustomer');
    if (customerFilter) {
      const prev = filters.customer;
      customerFilter.innerHTML = '<option value="">All customers</option><option value="' + AREA_OUTAGE_CUSTOMER_ID + '">Area outage (zone-wide)</option>' + customerOptions().map((c) => `<option value="${escapeHtml(String(c.id))}">${escapeHtml(c.label)}</option>`).join('');
      customerFilter.value = prev;
      filters.customer = customerFilter.value;
    }
    const zoneList = $('complaintZoneOptions');
    if (zoneList) zoneList.innerHTML = zones.map((z) => `<option value="${escapeHtml(z)}">`).join('');
    const addCustomer = $('complaintAddCustomer');
    if (addCustomer) {
      const prev = addCustomer.value;
      addCustomer.innerHTML = '<option value="">Select customer…</option><option value="' + AREA_OUTAGE_CUSTOMER_ID + '">Area outage (zone-wide fault)</option>' + customerOptions().map((c) => `<option value="${escapeHtml(String(c.id))}">${escapeHtml(c.label)}</option>`).join('');
      if ([...addCustomer.options].some((o) => o.value === prev)) addCustomer.value = prev;
    }
  }

  function statusButtons(complaint) {
    if (complaint.status === 'Open') {
      return `<button type="button" class="secondary-button complaint-status-btn" data-complaint-action="start" data-complaint-id="${escapeHtml(complaint.id)}">Start work</button><button type="button" class="primary-button complaint-status-btn" data-complaint-action="resolve" data-complaint-id="${escapeHtml(complaint.id)}">Mark resolved</button>`;
    }
    if (complaint.status === 'In Progress') {
      return `<button type="button" class="primary-button complaint-status-btn" data-complaint-action="resolve" data-complaint-id="${escapeHtml(complaint.id)}">Mark resolved</button><button type="button" class="secondary-button complaint-status-btn" data-complaint-action="reopen" data-complaint-id="${escapeHtml(complaint.id)}">Reopen</button>`;
    }
    return `<button type="button" class="secondary-button complaint-status-btn" data-complaint-action="reopen" data-complaint-id="${escapeHtml(complaint.id)}">Reopen</button>`;
  }

  function renderList() {
    const listEl = $('complaintRegisterList');
    if (!listEl) return;
    const rows = filterComplaints(loadComplaints(), filters);
    const summaryEl = $('complaintRegisterSummaryLine');
    if (summaryEl) {
      summaryEl.textContent = rows.length === 0
        ? 'No complaints match these filters.'
        : `${rows.length} complaint${rows.length === 1 ? '' : 's'} · ${rows.filter((c) => c.status === 'Open').length} open · ${rows.filter((c) => c.status === 'In Progress').length} in progress · ${rows.filter((c) => c.status === 'Resolved').length} resolved`;
    }
    if (rows.length === 0) {
      listEl.innerHTML = '<p class="complaint-register-empty">No complaints recorded yet. Add the first one above.</p>';
      return;
    }
    const sorted = [...rows].sort((a, b) => String(b.reportedAt || '').localeCompare(String(a.reportedAt || '')));
    listEl.innerHTML = sorted.map((c) => `
      <article class="complaint-register-card" data-complaint-id="${escapeHtml(c.id)}">
        <header class="complaint-register-head">
          <strong>${escapeHtml(c.id)}</strong>
          <span class="complaint-status-badge complaint-status-${c.status === 'Resolved' ? 'resolved' : c.status === 'In Progress' ? 'progress' : 'open'}">${escapeHtml(c.status)}</span>
        </header>
        <p><span>Customer</span><strong>${escapeHtml(complaintCustomerLabel(c))}</strong></p>
        <p><span>Zone</span><strong>${escapeHtml(c.zone || 'Not set')}</strong></p>
        <p><span>Issue</span><strong>${escapeHtml(c.issueCategory)}</strong></p>
        <p><span>Reported</span><input class="form-input complaint-inline-input" type="datetime-local" data-complaint-field="reportedAt" data-complaint-id="${escapeHtml(c.id)}" value="${escapeHtml(c.reportedAt || '')}" aria-label="Reported at"></p>
        <p><span>Resolved</span><input class="form-input complaint-inline-input" type="datetime-local" data-complaint-field="resolvedAt" data-complaint-id="${escapeHtml(c.id)}" value="${escapeHtml(c.resolvedAt || '')}" aria-label="Resolved at" ${c.status !== 'Resolved' ? 'disabled' : ''}></p>
        <p><span>Downtime</span><span class="complaint-downtime-wrap"><input class="form-input complaint-inline-input complaint-downtime-input" type="number" min="0" step="0.25" data-complaint-field="downtimeHours" data-complaint-id="${escapeHtml(c.id)}" value="${c.downtimeHours === null || c.downtimeHours === undefined ? '' : escapeHtml(String(c.downtimeHours))}" placeholder="auto" aria-label="Downtime hours"><small>h${c.downtimeManual ? ' (manual)' : ''}</small></span></p>
        <p><span>Fix note</span><input class="form-input complaint-inline-input" type="text" data-complaint-field="resolutionNote" data-complaint-id="${escapeHtml(c.id)}" value="${escapeHtml(c.resolutionNote || '')}" placeholder="Permanent fix…" aria-label="Resolution note"></p>
        <div class="complaint-register-actions">${statusButtons(c)}</div>
      </article>`).join('');
  }

  function persist(next) {
    saveComplaints(next);
    if (onComplaintsChanged) onComplaintsChanged(next);
  }

  function renderAll() {
    refreshFilterSelects();
    renderList();
  }

  const filterIds = {
    month: 'complaintFilterMonth',
    status: 'complaintFilterStatus',
    customer: 'complaintFilterCustomer',
    zone: 'complaintFilterZone',
    category: 'complaintFilterCategory'
  };
  for (const [key, id] of Object.entries(filterIds)) {
    const el = $(id);
    if (el) el.addEventListener('change', () => { filters[key] = el.value || ''; renderList(); });
  }
  const clearBtn = $('complaintFilterClearBtn');
  if (clearBtn) clearBtn.addEventListener('click', () => {
    Object.assign(filters, { month: '', status: '', customer: '', zone: '', category: '' });
    for (const [key, id] of Object.entries(filterIds)) {
      const el = $(id);
      if (el) el.value = '';
    }
    renderList();
  });

  const addForm = $('complaintAddForm');
  if (addForm) addForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const state = getState() || { customers: [] };
    const customerId = $('complaintAddCustomer')?.value || '';
    if (!customerId) { onToast && onToast('Select a customer or area outage first.'); return; }
    const customer = (Array.isArray(state.customers) ? state.customers : []).find((c) => String(c.id) === String(customerId));
    try {
      const next = [...loadComplaints(), createComplaint({
        customerId,
        customerName: customer ? customer.name : '',
        zone: $('complaintAddZone')?.value || (customer ? customer.zone : ''),
        issueCategory: $('complaintAddCategory')?.value || '',
        reportedAt: $('complaintAddReportedAt')?.value || '',
        resolutionNote: $('complaintAddNote')?.value || ''
      }, loadComplaints())];
      persist(next);
      onToast && onToast(`Complaint ${next[next.length - 1].id} recorded.`);
      addForm.reset();
      const reportedInput = $('complaintAddReportedAt');
      if (reportedInput) reportedInput.value = pakistanDateTimeNow();
      renderList();
    } catch (error) {
      onToast && onToast(error && error.message ? error.message : 'Complaint could not be recorded.');
    }
  });

  const listEl = $('complaintRegisterList');
  if (listEl) {
    listEl.addEventListener('click', (event) => {
      const btn = event.target.closest('.complaint-status-btn');
      if (!btn) return;
      const id = btn.dataset.complaintId;
      const action = btn.dataset.complaintAction;
      try {
        let next;
        if (action === 'resolve') next = setComplaintStatus(loadComplaints(), id, 'Resolved');
        else if (action === 'start') next = setComplaintStatus(loadComplaints(), id, 'In Progress');
        else if (action === 'reopen') next = setComplaintStatus(loadComplaints(), id, 'Open');
        else return;
        persist(next);
        const entry = next.find((c) => c.id === id);
        onToast && onToast(action === 'resolve'
          ? `Complaint ${id} resolved — downtime ${formatDowntimeHours(entry ? entry.downtimeHours : null)}.`
          : action === 'start' ? `Complaint ${id} in progress.` : `Complaint ${id} reopened.`);
        renderList();
      } catch (error) {
        onToast && onToast(error && error.message ? error.message : 'Status could not be changed.');
      }
    });
    listEl.addEventListener('change', (event) => {
      const input = event.target.closest('.complaint-inline-input');
      if (!input) return;
      const id = input.dataset.complaintId;
      const field = input.dataset.complaintField;
      try {
        const patch = { [field]: input.value };
        const next = updateComplaint(loadComplaints(), id, patch);
        saveComplaints(next);
        if (onComplaintsChanged) onComplaintsChanged(next);
        // Refresh only the downtime display of this card so auto-recomputed
        // values show without losing the user's edit focus.
        const card = listEl.querySelector(`article[data-complaint-id="${CSS.escape(id)}"]`);
        const entry = next.find((c) => c.id === id);
        if (card && entry && field !== 'downtimeHours') {
          const downtimeInput = card.querySelector('.complaint-downtime-input');
          if (downtimeInput && document.activeElement !== downtimeInput) {
            downtimeInput.value = entry.downtimeHours === null || entry.downtimeHours === undefined ? '' : String(entry.downtimeHours);
          }
        }
      } catch (error) {
        onToast && onToast(error && error.message ? error.message : 'Edit could not be saved.');
      }
    });
  }

  const closeBtn = $('complaintRegisterCloseBtn');
  if (closeBtn) closeBtn.addEventListener('click', () => dialog.close());
  const openBtn = typeof document !== 'undefined' ? document.getElementById('openComplaintRegisterModalBtn') : null;
  if (openBtn) openBtn.addEventListener('click', () => {
    Object.assign(filters, { month: '', status: '', customer: '', zone: '', category: '' });
    for (const [key, id] of Object.entries(filterIds)) {
      const el = $(id);
      if (el) el.value = '';
    }
    renderAll();
    dialog.showModal();
  });

  return {
    open(prefilter = {}) {
      Object.assign(filters, { month: '', status: '', customer: '', zone: '', category: '' }, prefilter);
      renderAll();
      for (const [key, id] of Object.entries(filterIds)) {
        const el = $(id);
        if (el && filters[key] !== undefined) el.value = filters[key];
      }
      renderList();
      dialog.showModal();
    },
    refresh: renderAll
  };
}
