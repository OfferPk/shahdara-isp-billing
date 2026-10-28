/**
 * install-tracker.js — New Customer Installation Tracker (user-ordered).
 *
 * Owner's problem (his words): a person asks for a new connection and
 * often PAYS FIRST — e.g. Master Zaheer sent Rs. 10,000 via EasyPaisa —
 * but the connection is NOT installed for days. The app must record the
 * request AND the reason for any delay (his examples: "Nasir did not send
 * fiber/ONU on time", "Saad did not come to install"), and at month end
 * show which customer got connected in how many days, and for delayed
 * ones WHY it was delayed.
 *
 * Delay math — exactly the owner's logic, no invented SLA, no grace days:
 * delayDays for an installed request = whole days from request date to
 * installation date (same-day install = 0). Total delay = SUM of all
 * installed customers' delay days in the month. Pending requests NEVER
 * enter the total: their days-so-far (today minus request date) is shown
 * separately, clearly marked "still pending".
 *
 * Data model — one record per installation request:
 * requesterName (free text, required — the person may NOT be a customer
 * record yet, so an existing customer is never required), customerId
 * (OPTIONAL link to a real customer record; a reference only — this
 * module never mutates the customer record), phone (optional),
 * requestDate (required), amountPaid PKR (required, >= 0), payMethod
 * (EasyPaisa / JazzCash / Cash / Bank Transfer / Other), payReference /
 * TID (optional), installDate (empty = still pending), delayReason
 * (free text; the form PROMPTS for it whenever installDate is later
 * than requestDate, but an empty reason never blocks a save and never
 * crashes the summary — it renders as "Reason not recorded").
 * Delay-reason presets are UI convenience only; the stored value is
 * always the final string, and custom-typed text wins over a preset.
 * Status is DERIVED, never stored: Pending (no installDate) / Installed
 * (installDate set). There is no Cancelled state — out of scope.
 *
 * Grouping: the month view groups by REQUEST month (the month the
 * payment/request came), so a request paid in October but installed in
 * November still counts in October's summary.
 *
 * Storage: requests live in localStorage under INSTALL_REQUESTS_KEY
 * (sisp_install_requests_v1), a flat array. Backup: requests travel in
 * the JSON backup `settings.installRequests` section (see core.js),
 * under the same safe-merge rule as the SISP-15 register and the Saad
 * visit log: adopted only when this device has none stored yet.
 *
 * This module imports nothing: customers are passed in by callers, so
 * the pure helpers stay testable without the app. Tests use synthetic
 * data only. This tracker records NOTHING about stock and never touches
 * billing-cycle.js or any billing engine.
 */

export const INSTALL_REQUESTS_KEY = 'sisp_install_requests_v1';

/** Payment methods: id + display label. */
export const PAY_METHODS = [
  { id: 'easypaisa', label: 'EasyPaisa' },
  { id: 'jazzcash', label: 'JazzCash' },
  { id: 'cash', label: 'Cash' },
  { id: 'bank', label: 'Bank Transfer' },
  { id: 'other', label: 'Other' }
];

export const PAY_METHOD_IDS = PAY_METHODS.map((m) => m.id);

/** Quick-pick delay reasons (UI only — the stored value is free text). */
export const DELAY_REASON_PRESETS = [
  'Fiber/ONU late — Nasir',
  'Saad did not come',
  'Customer not available',
  'Weather / area issue',
  'Other'
];

export const REASON_NOT_RECORDED = 'Reason not recorded';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const REQUEST_ID_RE = /^IR-(\d+)$/;

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

/** YYYY-MM-DD in Pakistan time (mirrors roznamcha.js pakistanToday). */
export function installTrackerToday(referenceDate = new Date()) {
  const date = referenceDate instanceof Date && !Number.isNaN(referenceDate.getTime())
    ? referenceDate
    : new Date();
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Karachi', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type)?.value || '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** YYYY-MM month of a YYYY-MM-DD date. */
export function monthOf(date) {
  return DATE_RE.test(String(date || '')) ? String(date).slice(0, 7) : '';
}

/** Whole days from dateA to dateB (UTC, timezone-safe); null when unusable. */
export function wholeDaysBetween(dateA, dateB) {
  if (!DATE_RE.test(String(dateA || '')) || !DATE_RE.test(String(dateB || ''))) return null;
  const toUtc = (d) => Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10)));
  return Math.round((toUtc(dateB) - toUtc(dateA)) / 86400000);
}

export function payMethodLabel(methodId) {
  return PAY_METHODS.find((m) => m.id === methodId)?.label || methodId || '—';
}

/** Display name: snapshot name, or linked customer name, or '—'. */
export function requestNameLabel(request) {
  if (!request) return '—';
  return request.requesterName || request.customerName || '—';
}

/** Derived status: 'Installed' when installDate is set, else 'Pending'. */
export function requestStatus(request) {
  return request && DATE_RE.test(String(request.installDate || '')) ? 'Installed' : 'Pending';
}

/**
 * Delay days for one request, owner's exact logic: whole days from
 * request date to installation date (same-day install = 0). Pending
 * requests return null — they have no delay yet, only days-so-far.
 */
export function delayDays(request) {
  if (!request || !DATE_RE.test(String(request.installDate || ''))) return null;
  const days = wholeDaysBetween(request.requestDate, request.installDate);
  return days === null || days < 0 ? null : days;
}

/**
 * Days-so-far for a PENDING request: today minus request date, clamped
 * at 0 (a future-dated request never shows negative days). Installed
 * requests return null — use delayDays for them.
 */
export function daysSoFar(request, today) {
  if (!request || DATE_RE.test(String(request.installDate || ''))) return null;
  const days = wholeDaysBetween(request.requestDate, today || installTrackerToday());
  return days === null || days < 0 ? 0 : days;
}

/** Reason to display: stored text, or the "not recorded" fallback. */
export function delayReasonLabel(request) {
  const reason = cleanText(request?.delayReason);
  return reason || REASON_NOT_RECORDED;
}

/** Drops malformed rows; keeps clean requests in stored order. */
export function sanitizeInstallRequests(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue;
    const requesterName = cleanText(entry.requesterName) || cleanText(entry.customerName);
    if (!requesterName) continue;
    const requestDate = DATE_RE.test(String(entry.requestDate || '')) ? String(entry.requestDate) : '';
    if (!requestDate) continue;
    const amount = Number(entry.amountPaid);
    if (!Number.isFinite(amount) || amount < 0) continue;
    const payMethod = PAY_METHOD_IDS.includes(entry.payMethod) ? entry.payMethod : 'other';
    // A bad install date never kills the request: it stays pending.
    let installDate = DATE_RE.test(String(entry.installDate || '')) ? String(entry.installDate) : '';
    if (installDate && wholeDaysBetween(requestDate, installDate) < 0) installDate = '';
    out.push({
      id: cleanText(entry.id),
      requesterName,
      customerId: cleanText(entry.customerId),
      customerName: cleanText(entry.customerName),
      customerNumber: entry.customerNumber === null || entry.customerNumber === undefined || entry.customerNumber === ''
        ? null
        : entry.customerNumber,
      phone: cleanText(entry.phone),
      requestDate,
      amountPaid: Math.round(amount * 100) / 100,
      payMethod,
      payReference: cleanText(entry.payReference),
      installDate,
      delayReason: cleanText(entry.delayReason),
      createdAt: typeof entry.createdAt === 'string' ? entry.createdAt : ''
    });
  }
  return out;
}

/** Reads request records; [] on missing/corrupt storage. */
export function loadInstallRequests(storage) {
  try {
    const store = storage || (typeof globalThis !== 'undefined' ? globalThis.localStorage : null);
    if (!store) return [];
    const raw = store.getItem(INSTALL_REQUESTS_KEY);
    if (!raw) return [];
    return sanitizeInstallRequests(JSON.parse(raw));
  } catch {
    return [];
  }
}

/** Persists request records; never throws. */
export function saveInstallRequests(requests, storage) {
  try {
    const store = storage || (typeof globalThis !== 'undefined' ? globalThis.localStorage : null);
    if (!store) return false;
    store.setItem(INSTALL_REQUESTS_KEY, JSON.stringify(sanitizeInstallRequests(requests)));
    return true;
  } catch {
    return false;
  }
}

function nextRequestId(requests) {
  let max = 0;
  for (const r of requests) {
    const match = REQUEST_ID_RE.exec(String(r.id || ''));
    if (match) max = Math.max(max, Number(match[1]));
  }
  return `IR-${max + 1}`;
}

/** Resolves the stored delay reason: custom text wins over a preset. */
export function resolveDelayReason(preset, custom) {
  const typed = cleanText(custom);
  if (typed) return typed;
  const picked = cleanText(preset);
  if (picked && picked !== 'Other') return picked;
  return '';
}

/**
 * Appends one installation request. Throws on a missing requester name,
 * a bad request date, a missing/negative amount, an unknown payment
 * method, an unknown linked customer id, or an install date before the
 * request date. An empty delay reason is ALLOWED (prompted, never
 * blocking). Returns the new request list (input untouched). Linking a
 * customer only snapshots name/number — the customer record is never
 * mutated.
 */
export function addInstallRequest(requests, input, { customers = [] } = {}) {
  const clean = sanitizeInstallRequests(requests);
  const requesterName = cleanText(input.requesterName);
  if (!requesterName) throw new Error('Requester name is required — who asked for the connection?');
  const requestDate = DATE_RE.test(String(input.requestDate || '')) ? String(input.requestDate) : '';
  if (!requestDate) throw new Error('A valid request date is required.');
  if (input.amountPaid === null || input.amountPaid === undefined || input.amountPaid === '') {
    throw new Error('Amount paid (PKR) is required — enter 0 if nothing was paid yet.');
  }
  const amountPaid = Number(input.amountPaid);
  if (!Number.isFinite(amountPaid) || amountPaid < 0) throw new Error('Amount paid must be a PKR number of 0 or more.');
  const payMethod = PAY_METHOD_IDS.includes(input.payMethod) ? input.payMethod : null;
  if (!payMethod) throw new Error('A valid payment method is required.');
  const installDate = DATE_RE.test(String(input.installDate || '')) ? String(input.installDate) : '';
  if (installDate && wholeDaysBetween(requestDate, installDate) < 0) {
    throw new Error('Install date cannot be before the request date.');
  }
  const customerId = cleanText(input.customerId);
  let customerName = '';
  let customerNumber = null;
  if (customerId) {
    const customer = customers.find((c) => String(c.id) === customerId);
    if (!customer) throw new Error('Pick a customer from the list — or leave it blank for a not-yet-customer.');
    customerName = cleanText(customer.name);
    customerNumber = customer.customerNumber === null || customer.customerNumber === undefined
      ? null
      : customer.customerNumber;
  }
  const record = {
    id: nextRequestId(clean),
    requesterName,
    customerId,
    customerName,
    customerNumber,
    phone: cleanText(input.phone),
    requestDate,
    amountPaid: Math.round(amountPaid * 100) / 100,
    payMethod,
    payReference: cleanText(input.payReference),
    installDate,
    delayReason: cleanText(input.delayReason),
    createdAt: new Date().toISOString()
  };
  return [...clean, record];
}

/**
 * Marks a pending request installed. Throws on an unknown id, an
 * already-installed request, a bad install date, or an install date
 * before the request date. A supplied delay reason replaces the stored
 * one; an omitted reason keeps whatever was recorded. Returns the new
 * request list (input untouched).
 */
export function markInstallRequestInstalled(requests, id, { installDate, delayReason } = {}) {
  const clean = sanitizeInstallRequests(requests);
  const index = clean.findIndex((r) => String(r.id) === String(id));
  if (index === -1) throw new Error('That installation request was not found.');
  const request = clean[index];
  if (DATE_RE.test(String(request.installDate || ''))) throw new Error('This connection is already marked installed.');
  const date = DATE_RE.test(String(installDate || '')) ? String(installDate) : '';
  if (!date) throw new Error('A valid install date is required.');
  if (wholeDaysBetween(request.requestDate, date) < 0) {
    throw new Error('Install date cannot be before the request date.');
  }
  const updated = { ...request, installDate: date };
  if (delayReason !== undefined && delayReason !== null) updated.delayReason = cleanText(delayReason);
  const out = [...clean];
  out[index] = updated;
  return out;
}

/** Requests in one YYYY-MM month (by REQUEST month), oldest first. */
export function requestsForMonth(requests, month) {
  return sanitizeInstallRequests(requests)
    .filter((r) => monthOf(r.requestDate) === month)
    .sort((a, b) => {
      if (a.requestDate !== b.requestDate) return a.requestDate < b.requestDate ? -1 : 1;
      return a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0;
    });
}

/** Request log, latest first (request date desc, then created order desc). */
export function sortedRequestLog(requests) {
  const clean = sanitizeInstallRequests(requests);
  return [...clean].sort((a, b) => {
    if (a.requestDate !== b.requestDate) return a.requestDate < b.requestDate ? 1 : -1;
    return a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0;
  });
}

/** Filtered log: by request month; newest first. */
export function filterInstallRequests(requests, { month = '' } = {}) {
  return sortedRequestLog(requests).filter((r) => {
    if (month && monthOf(r.requestDate) !== month) return false;
    return true;
  });
}

/**
 * Month-end summary, fully COMPUTED from stored requests (grouped by
 * REQUEST month):
 * - installed: [{ name, requestDate, installDate, days, reason, delayed }]
 * - pending: [{ name, requestDate, daysSoFar }] (days-so-far only)
 * - totalDelayDays: SUM of installed delay days ONLY (pending never counts)
 * - averageDays: totalDelayDays / installedCount, display only (0 when none)
 * - counts: requests, installed, pending
 * A month with no requests yields all zeros, never blank or a crash.
 */
export function buildMonthlyInstallSummary(requests, month, today) {
  const monthRequests = requestsForMonth(requests, month);
  const day = today || installTrackerToday();
  const installed = [];
  const pending = [];
  for (const r of monthRequests) {
    const name = requestNameLabel(r);
    if (DATE_RE.test(String(r.installDate || ''))) {
      const days = delayDays(r);
      installed.push({
        id: r.id,
        name,
        requestDate: r.requestDate,
        installDate: r.installDate,
        days: days === null ? 0 : days,
        reason: delayReasonLabel(r),
        delayed: (days || 0) > 0
      });
    } else {
      pending.push({ id: r.id, name, requestDate: r.requestDate, daysSoFar: daysSoFar(r, day) || 0 });
    }
  }
  const totalDelayDays = installed.reduce((sum, row) => sum + row.days, 0);
  const averageDays = installed.length === 0
    ? 0
    : Math.round((totalDelayDays / installed.length) * 10) / 10;
  return {
    month,
    requests: monthRequests,
    installed,
    pending,
    requestCount: monthRequests.length,
    installedCount: installed.length,
    pendingCount: pending.length,
    totalDelayDays,
    averageDays
  };
}

/**
 * Dashboard + modal controller, following the Saad visits pattern:
 * open() / refresh(), open button wired by id, close button, form submits.
 * getState supplies the live customer list (injected so this module stays
 * import-free). The mark-installed section lists only pending requests.
 */
export function setupInstallTrackerModal(getState, { onRequestsChanged, onToast } = {}) {
  const dialog = typeof document !== 'undefined' ? document.getElementById('installTrackerModal') : null;
  if (!dialog) return null;
  const $ = (id) => dialog.querySelector(`#${id}`);
  const getCustomers = () => {
    try {
      const state = typeof getState === 'function' ? getState() : null;
      return Array.isArray(state?.customers) ? state.customers : [];
    } catch {
      return [];
    }
  };

  function customerOptions(customers, query) {
    const q = (query || '').trim().toLowerCase();
    const rows = customers.filter((c) => {
      if (!q) return true;
      return String(c.name || '').toLowerCase().includes(q)
        || String(c.customerNumber ?? '').includes(q)
        || String(c.mohalla || '').toLowerCase().includes(q);
    });
    return rows.map((c) => {
      const label = `${c.name || 'Unnamed'} (#${c.customerNumber ?? '—'})${c.mohalla ? ` · ${c.mohalla}` : ''}`;
      return `<option value="${escapeHtml(String(c.id))}">${escapeHtml(label)}</option>`;
    }).join('');
  }

  function refreshCustomerSelect() {
    const select = $('installRequestCustomer');
    if (!select) return;
    const prev = select.value;
    const placeholder = '<option value="">Not a customer yet — free-text name only</option>';
    select.innerHTML = placeholder + customerOptions(getCustomers(), $('installRequestCustomerSearch')?.value);
    if ([...select.options].some((o) => o.value === prev)) select.value = prev;
  }

  function refreshPendingSelect() {
    const select = $('installMarkRequest');
    if (!select) return;
    const pending = sortedRequestLog(loadInstallRequests()).filter((r) => !DATE_RE.test(String(r.installDate || '')));
    const prev = select.value;
    select.innerHTML = pending.length === 0
      ? '<option value="">No pending requests</option>'
      : '<option value="">Pick a pending request…</option>' + pending.map((r) =>
        `<option value="${escapeHtml(String(r.id))}">${escapeHtml(requestNameLabel(r))} · ${escapeHtml(r.requestDate)}</option>`).join('');
    if ([...select.options].some((o) => o.value === prev)) select.value = prev;
  }

  function render() {
    const month = $('installTrackerMonth')?.value || monthOf(installTrackerToday());
    if ($('installTrackerMonth') && !$('installTrackerMonth').value) $('installTrackerMonth').value = month;
    const requests = loadInstallRequests();
    const summary = buildMonthlyInstallSummary(requests, month, installTrackerToday());
    const summaryEl = $('installTrackerMonthSummary');
    if (summaryEl) {
      const installedLines = summary.installed.length === 0
        ? '<p class="install-tracker-empty">Is mahine koi connection install nahi hua.</p>'
        : summary.installed.map((row) => `
          <article class="install-tracker-card">
            <p><span>${escapeHtml(row.name)}</span><strong>${row.days} day${row.days === 1 ? '' : 's'}</strong></p>
            <p><span>Requested</span><strong>${escapeHtml(row.requestDate)}</strong></p>
            <p><span>Installed</span><strong>${escapeHtml(row.installDate)}</strong></p>
            ${row.delayed ? `<p><span>Delay reason</span><strong>${escapeHtml(row.reason)}</strong></p>` : '<p><span>Delay reason</span><strong>Same-day install — no delay</strong></p>'}
          </article>`).join('');
      const pendingLines = summary.pending.length === 0
        ? '<p class="install-tracker-empty">Is mahine koi pending request nahi hai.</p>'
        : summary.pending.map((row) => `
          <article class="install-tracker-card install-tracker-pending">
            <p><span>${escapeHtml(row.name)}</span><strong>still pending · ${row.daysSoFar} day${row.daysSoFar === 1 ? '' : 's'} so far</strong></p>
            <p><span>Requested</span><strong>${escapeHtml(row.requestDate)}</strong></p>
          </article>`).join('');
      summaryEl.innerHTML = `
        <div class="install-tracker-summary-cards">
          <p><span>Requests</span><strong>${summary.requestCount}</strong></p>
          <p><span>Installed</span><strong>${summary.installedCount}</strong></p>
          <p><span>Pending</span><strong>${summary.pendingCount}</strong></p>
          <p><span>Total delay days</span><strong>${summary.totalDelayDays}</strong></p>
          <p><span>Average days per install</span><strong>${summary.averageDays}</strong></p>
        </div>
        <p class="install-tracker-note">Total delay days = installed connections ke delay days ka sum. Pending requests ke din is total me shamil NAHI hote — wo sirf "still pending" me dikhte hain.</p>
        <h3>Installed this month (${escapeHtml(month)})</h3>
        <div class="install-tracker-list">${installedLines}</div>
        <h3>Still pending (${escapeHtml(month)})</h3>
        <div class="install-tracker-list">${pendingLines}</div>`;
    }
    const listEl = $('installTrackerList');
    if (listEl) {
      const rows = filterInstallRequests(requests, { month });
      listEl.innerHTML = rows.length === 0
        ? '<p class="install-tracker-empty">No requests in this month.</p>'
        : rows.map((r) => {
          const installed = DATE_RE.test(String(r.installDate || ''));
          const days = installed ? delayDays(r) : daysSoFar(r, installTrackerToday());
          return `
          <article class="install-tracker-card${installed ? '' : ' install-tracker-pending'}">
            <p><span>${escapeHtml(requestNameLabel(r))}</span><strong>${installed ? `${days} day${days === 1 ? '' : 's'} · Installed` : `still pending · ${days} day${days === 1 ? '' : 's'} so far`}</strong></p>
            <p><span>Requested</span><strong>${escapeHtml(r.requestDate)}</strong></p>
            ${installed ? `<p><span>Installed</span><strong>${escapeHtml(r.installDate)}</strong></p>` : ''}
            <p><span>Paid</span><strong>${escapeHtml(String(r.amountPaid))} PKR · ${escapeHtml(payMethodLabel(r.payMethod))}${r.payReference ? ` · ${escapeHtml(r.payReference)}` : ''}</strong></p>
            ${r.phone ? `<p><span>Phone</span><strong>${escapeHtml(r.phone)}</strong></p>` : ''}
            ${r.customerName ? `<p><span>Linked customer</span><strong>${escapeHtml(r.customerName)}${r.customerNumber !== null ? ` (#${r.customerNumber})` : ''}</strong></p>` : ''}
            ${installed && (days || 0) > 0 ? `<p><span>Delay reason</span><strong>${escapeHtml(delayReasonLabel(r))}</strong></p>` : ''}
          </article>`;
        }).join('');
    }
    refreshCustomerSelect();
    refreshPendingSelect();
    const dateInput = $('installRequestDate');
    if (dateInput && !dateInput.value) dateInput.value = installTrackerToday();
    const markDateInput = $('installMarkDate');
    if (markDateInput && !markDateInput.value) markDateInput.value = installTrackerToday();
  }

  const searchInput = $('installRequestCustomerSearch');
  if (searchInput) searchInput.addEventListener('input', refreshCustomerSelect);
  const monthInput = $('installTrackerMonth');
  if (monthInput) monthInput.addEventListener('change', render);

  const form = $('installRequestForm');
  if (form) {
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      try {
        const updated = addInstallRequest(loadInstallRequests(), {
          requesterName: $('installRequestName')?.value,
          customerId: $('installRequestCustomer')?.value,
          phone: $('installRequestPhone')?.value,
          requestDate: $('installRequestDate')?.value,
          amountPaid: $('installRequestAmount')?.value,
          payMethod: $('installRequestPayMethod')?.value,
          payReference: $('installRequestPayReference')?.value,
          installDate: $('installRequestInstallDate')?.value,
          delayReason: resolveDelayReason($('installRequestReasonPreset')?.value, $('installRequestReasonCustom')?.value)
        }, { customers: getCustomers() });
        saveInstallRequests(updated);
        form.reset();
        const dateInput = $('installRequestDate');
        if (dateInput) dateInput.value = installTrackerToday();
        render();
        if (typeof onRequestsChanged === 'function') onRequestsChanged();
        if (typeof onToast === 'function') onToast('Installation request recorded.');
      } catch (error) {
        if (typeof onToast === 'function') onToast(error.message || 'Could not record request.');
      }
    });
  }
  const markForm = $('installMarkForm');
  if (markForm) {
    markForm.addEventListener('submit', (event) => {
      event.preventDefault();
      try {
        const reason = resolveDelayReason($('installMarkReasonPreset')?.value, $('installMarkReasonCustom')?.value);
        const updated = markInstallRequestInstalled(loadInstallRequests(), $('installMarkRequest')?.value, {
          installDate: $('installMarkDate')?.value,
          ...(reason ? { delayReason: reason } : {})
        });
        saveInstallRequests(updated);
        markForm.reset();
        const markDateInput = $('installMarkDate');
        if (markDateInput) markDateInput.value = installTrackerToday();
        render();
        if (typeof onRequestsChanged === 'function') onRequestsChanged();
        if (typeof onToast === 'function') onToast('Connection marked installed.');
      } catch (error) {
        if (typeof onToast === 'function') onToast(error.message || 'Could not mark installed.');
      }
    });
  }
  const closeBtn = $('installTrackerCloseBtn');
  if (closeBtn) closeBtn.addEventListener('click', () => dialog.close());
  const openBtn = typeof document !== 'undefined' ? document.getElementById('openInstallTrackerModalBtn') : null;
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
