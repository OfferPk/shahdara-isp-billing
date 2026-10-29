/**
 * install-tracker.js — New Customer Installation Tracker (user-ordered).
 *
 * Owner's problem (his words): a person asks for a new connection and
 * often PAYS FIRST — e.g. a customer sent Rs. 10,000 via EasyPaisa —
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
 * This module originally imported nothing: customers are passed in by
 * callers, so the pure helpers stay testable without the app. Tests use
 * synthetic data only.
 *
 * SISP-57 — completion pipeline: marking a request installed now runs a
 * 1-click completion (see buildInstallCompletionPlan /
 * applyInstallCompletion below). The plan either LINKs the request's
 * already-linked customer or CREATEs a new active customer from the
 * request (name + phone), records the operator-entered connection
 * fields (connectionFee, routerModel, routerPrice, fiberMeters) on that
 * customer, and stages Stock Out deductions for the SISP-18 inventory
 * book (router / media converter / 2-core fiber meters actually used).
 * The customer write and the stock write themselves are performed by
 * the app.js handler injected into the modal (this module never imports
 * core.js or inventory-book.js — the inventory book's addMovement stays
 * the ONLY stock write path, and available quantities are computed with
 * the book's own computeStock semantics passed in as movements).
 * Durable guard: a completed request carries completedCustomerId +
 * completion.stockDeductedAt; completing it again is a no-op for both
 * the customer record and the stock book, so a re-mark, an edit that
 * cleared the install date, or a backup restore can never deduct the
 * same stock twice. Insufficient or missing stock never blocks the
 * completion (the field work already happened): that line is skipped
 * and surfaced as a visible warning, mirroring the SISP-42 bridge,
 * where a refused deduction never undoes the underlying work.
 */
import { t } from './nav-language.js';

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

/**
 * SISP-57: the stock lines a completion can deduct, keyed by the
 * operator-facing quantity field. itemId values are the SISP-18
 * inventory book's OWN catalog ids (inventory-book.js INVENTORY_ITEMS)
 * — the pipeline never invents an item; a line whose id is absent from
 * the live catalog is skipped with a warning instead of deducted.
 */
export const INSTALL_COMPLETION_STOCK = [
  { key: 'router', itemId: 'router', label: 'Router' },
  { key: 'mediaConverter', itemId: 'media-converter', label: 'Media Converter Pair' },
  { key: 'fiber', itemId: 'fiber-2core', label: '2-Core Fiber Cable' }
];

const INSTALL_STOCK_ITEM_IDS = INSTALL_COMPLETION_STOCK.map((line) => line.itemId);

function moneyOrNull(value) {
  if (value === '' || value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
}

function qtyOrZero(value) {
  const n = Number(value);
  return Number.isFinite(n) && Number.isInteger(n) && n > 0 ? n : 0;
}

/**
 * SISP-57 completion stamp, sanitized: the connection fields the
 * operator recorded, the quantities used, exactly which stock lines
 * were deducted, which were skipped (with the stock available at the
 * time), and when the deduction happened. Returns null when the stored
 * value carries no completion (a legacy / plain mark-installed record).
 */
export function sanitizeInstallCompletion(value) {
  if (!value || typeof value !== 'object') return null;
  const stockDeductedAt = typeof value.stockDeductedAt === 'string' ? value.stockDeductedAt : '';
  if (!stockDeductedAt) return null;
  const lines = (list) => (Array.isArray(list) ? list : [])
    .filter((line) => line && typeof line === 'object' && INSTALL_STOCK_ITEM_IDS.includes(cleanText(line.itemId)))
    .map((line) => ({ itemId: cleanText(line.itemId), qty: Number(line.qty) }))
    .filter((line) => Number.isFinite(line.qty) && line.qty > 0);
  return {
    connectionFee: moneyOrNull(value.connectionFee),
    routerModel: cleanText(value.routerModel).slice(0, 100),
    routerPrice: moneyOrNull(value.routerPrice),
    fiberMeters: (() => {
      const n = Number(value.fiberMeters);
      return value.fiberMeters === '' || value.fiberMeters === null || value.fiberMeters === undefined || !Number.isFinite(n) || n < 0
        ? null
        : Math.round(n * 10) / 10;
    })(),
    routerQty: qtyOrZero(value.routerQty),
    mediaConverterQty: qtyOrZero(value.mediaConverterQty),
    stockDeductions: lines(value.stockDeductions),
    stockWarnings: lines(value.stockWarnings).map((line) => {
      const raw = (Array.isArray(value.stockWarnings) ? value.stockWarnings : [])
        .find((w) => w && cleanText(w.itemId) === line.itemId);
      const available = Number(raw?.available);
      return { ...line, available: Number.isFinite(available) && available >= 0 ? available : 0, reason: cleanText(raw?.reason) || 'insufficient' };
    }),
    stockDeductedAt
  };
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
      // SISP-57 completion stamp (null until the pipeline completes the
      // request): survives sanitize + backup round-trips so the stock
      // deduction can never run twice for one request.
      completedCustomerId: cleanText(entry.completedCustomerId),
      completion: sanitizeInstallCompletion(entry.completion),
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
 * Validates one request's form input and returns the stored fields (no
 * id, no createdAt). Shared by create and edit so both enforce the SAME
 * rules and messages: requester name + request date required, amount
 * 0 or more, a known payment method, install date never before the
 * request date, and a linked customer only from the live list. When
 * `existing` is given (edit) and its customer id is unchanged but that
 * customer left the list, the stored name/number snapshot is kept
 * instead of throwing — the entry stays readable; changing to a
 * different id still requires a live customer from the list. An empty
 * delay reason is ALLOWED (prompted, never blocking). Linking a
 * customer only snapshots name/number — the customer record is never
 * mutated.
 */
export function buildRequestFields(input, { customers = [], existing = null } = {}) {
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
    if (customer) {
      customerName = cleanText(customer.name);
      customerNumber = customer.customerNumber === null || customer.customerNumber === undefined
        ? null
        : customer.customerNumber;
    } else if (existing && String(existing.customerId) === customerId) {
      customerName = cleanText(existing.customerName);
      customerNumber = existing.customerNumber === null || existing.customerNumber === undefined
        ? null
        : existing.customerNumber;
    } else {
      throw new Error('Pick a customer from the list — or leave it blank for a not-yet-customer.');
    }
  }
  return {
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
    delayReason: cleanText(input.delayReason)
  };
}

/**
 * Appends one request. Same validation as edit via buildRequestFields.
 * Returns the new request list (input untouched).
 */
export function addInstallRequest(requests, input, { customers = [] } = {}) {
  const clean = sanitizeInstallRequests(requests);
  const fields = buildRequestFields(input, { customers });
  const record = {
    id: nextRequestId(clean),
    ...fields,
    createdAt: new Date().toISOString()
  };
  return [...clean, record];
}

/**
 * Edits one request IN PLACE (same id, same list position, same
 * createdAt). Same validation as create via buildRequestFields; the
 * stored record is merged, never replaced wholesale, so id/createdAt
 * and any field the form does not show survive the edit. Throws on an
 * unknown id. Returns the new request list (input untouched). Delay
 * days and month totals are computed from the list, so they reflect
 * the edit at once — clearing the install date returns the request to
 * Pending and drops it from the delay total.
 */
export function updateInstallRequest(requests, id, input, { customers = [] } = {}) {
  const clean = sanitizeInstallRequests(requests);
  const index = clean.findIndex((r) => String(r.id) === String(id));
  if (index === -1) throw new Error('That request was not found.');
  const fields = buildRequestFields(input, { customers, existing: clean[index] });
  const out = [...clean];
  out[index] = { ...clean[index], ...fields };
  return out;
}

/**
 * Deletes one request. Throws on an unknown id. Returns the new request
 * list (input untouched). Computed month summaries drop the request at
 * once; a later backup export no longer contains it, so a fresh-state
 * restore cannot resurrect it.
 */
export function deleteInstallRequest(requests, id) {
  const clean = sanitizeInstallRequests(requests);
  if (!clean.some((r) => String(r.id) === String(id))) throw new Error('That request was not found.');
  return clean.filter((r) => String(r.id) !== String(id));
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

function completionMoney(value, label) {
  if (value === '' || value === null || value === undefined) return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) throw new Error(`${label} must be a PKR number of 0 or more.`);
  return Math.round(n * 100) / 100;
}

function completionQty(value, label) {
  if (value === '' || value === null || value === undefined) return 0;
  const n = Number(value);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) throw new Error(`${label} must be a whole number of 0 or more.`);
  return n;
}

/** Available qty for one item from a movement list (inventory-book semantics: in − out). */
function completionAvailable(movements, itemId) {
  let available = 0;
  for (const m of Array.isArray(movements) ? movements : []) {
    if (!m || m.itemId !== itemId) continue;
    const qty = Number(m.qty);
    if (!Number.isFinite(qty)) continue;
    if (m.kind === 'in') available += qty;
    else if (m.kind === 'out') available -= qty;
  }
  return Math.round(available * 100) / 100;
}

/**
 * SISP-57: builds the completion plan for marking one request installed
 * — PURE, performs no writes. The caller (app.js) executes the plan:
 * create-or-link the customer, then log the plan's Stock Out movements
 * through inventory-book addMovement, then stamp the request via
 * applyInstallCompletion.
 *
 * Create-vs-link: a request that already carries a customerId LINKS to
 * that customer (it must still exist in `customers` — a vanished link
 * throws so the operator can fix it, never silently duplicates); any
 * other request CREATEs a new active customer from requesterName +
 * phone. On a link, only the connection fields the operator actually
 * entered are returned in customerFields (blanks never overwrite the
 * existing record); on a create, all four fields travel in newCustomer.
 *
 * Stock: quantities come ONLY from the operator's completion input
 * (routerQty, mediaConverterQty, and fiberMeters doubling as the fiber
 * drop length). A line is staged as a deduction only when its catalog
 * item exists in `inventoryItemIds` (when given) AND the available
 * stock in `movements` covers it; otherwise the line lands in warnings
 * ({ itemId, qty, available, reason: 'unavailable' | 'insufficient' })
 * and the completion still proceeds — warn-and-allow, per SISP-42.
 * When `movements` is not supplied, availability is unchecked and every
 * line is staged (the executing addMovement still refuses an
 * over-draw, which the caller surfaces).
 *
 * Double completion: a request already carrying completedCustomerId
 * returns { alreadyCompleted: true } with NO customer fields and NO
 * deductions — re-completing is a no-op for customer and stock alike.
 * A request already marked installed WITHOUT a completion stamp throws,
 * exactly like markInstallRequestInstalled.
 */
export function buildInstallCompletionPlan(request, input = {}, { customers = [], movements = null, inventoryItemIds = null } = {}) {
  if (!request || typeof request !== 'object') throw new Error('That installation request was not found.');
  const installDate = DATE_RE.test(String(input.installDate || '')) ? String(input.installDate) : '';
  if (!installDate) throw new Error('A valid install date is required.');
  if (wholeDaysBetween(request.requestDate, installDate) < 0) {
    throw new Error('Install date cannot be before the request date.');
  }
  const delayReason = input.delayReason === undefined || input.delayReason === null ? undefined : cleanText(input.delayReason);
  if (cleanText(request.completedCustomerId)) {
    return {
      requestId: cleanText(request.id),
      alreadyCompleted: true,
      installDate,
      delayReason,
      mode: 'link',
      customerId: cleanText(request.completedCustomerId),
      customerName: cleanText(request.customerName) || cleanText(request.requesterName),
      customerFields: {},
      newCustomer: null,
      completion: sanitizeInstallCompletion(request.completion),
      deductions: [],
      warnings: []
    };
  }
  if (DATE_RE.test(String(request.installDate || ''))) throw new Error('This connection is already marked installed.');

  const connectionFee = completionMoney(input.connectionFee, 'Connection fee');
  const routerPrice = completionMoney(input.routerPrice, 'Router price');
  const routerModel = cleanText(input.routerModel).slice(0, 100);
  let fiberMeters = null;
  if (input.fiberMeters !== '' && input.fiberMeters !== null && input.fiberMeters !== undefined) {
    const n = Number(input.fiberMeters);
    if (!Number.isFinite(n) || n < 0) throw new Error('Fiber meters must be a number of 0 or more.');
    fiberMeters = Math.round(n * 10) / 10;
  }
  const routerQty = completionQty(input.routerQty, 'Routers used');
  const mediaConverterQty = completionQty(input.mediaConverterQty, 'Media converters used');

  const linkedId = cleanText(request.customerId);
  let mode;
  let customerId = '';
  let customerName = '';
  let customerFields = {};
  let newCustomer = null;
  if (linkedId) {
    const customer = (Array.isArray(customers) ? customers : []).find((c) => String(c.id) === linkedId);
    if (!customer) throw new Error('The linked customer is no longer in the list — edit the request to fix the link before completing it.');
    mode = 'link';
    customerId = String(customer.id);
    customerName = cleanText(customer.name);
    if (connectionFee !== null) customerFields.connectionFee = connectionFee;
    if (routerModel) customerFields.routerModel = routerModel;
    if (routerPrice !== null) customerFields.routerPrice = routerPrice;
    if (fiberMeters !== null) customerFields.fiberMeters = fiberMeters;
  } else {
    mode = 'create';
    customerName = cleanText(request.requesterName) || cleanText(request.customerName);
    newCustomer = {
      name: customerName,
      phone: cleanText(request.phone),
      connectionFee,
      routerModel,
      routerPrice,
      fiberMeters
    };
  }

  const wanted = [
    { itemId: 'router', qty: routerQty },
    { itemId: 'media-converter', qty: mediaConverterQty },
    { itemId: 'fiber-2core', qty: fiberMeters || 0 }
  ];
  const deductions = [];
  const warnings = [];
  for (const line of wanted) {
    if (!(line.qty > 0)) continue;
    if (Array.isArray(inventoryItemIds) && !inventoryItemIds.includes(line.itemId)) {
      warnings.push({ itemId: line.itemId, qty: line.qty, available: 0, reason: 'unavailable' });
      continue;
    }
    if (movements !== null && movements !== undefined) {
      const available = completionAvailable(movements, line.itemId);
      if (line.qty > available) {
        warnings.push({ itemId: line.itemId, qty: line.qty, available, reason: 'insufficient' });
        continue;
      }
    }
    deductions.push({
      itemId: line.itemId,
      kind: 'out',
      qty: line.qty,
      date: installDate,
      customerName,
      note: `Installation ${cleanText(request.id)} — ${INSTALL_COMPLETION_STOCK.find((s) => s.itemId === line.itemId)?.label || line.itemId}`
    });
  }

  return {
    requestId: cleanText(request.id),
    alreadyCompleted: false,
    installDate,
    delayReason,
    mode,
    customerId,
    customerName,
    customerFields,
    newCustomer,
    completion: {
      connectionFee,
      routerModel,
      routerPrice,
      fiberMeters,
      routerQty,
      mediaConverterQty,
      stockDeductions: deductions.map((d) => ({ itemId: d.itemId, qty: d.qty })),
      stockWarnings: warnings
    },
    deductions,
    warnings
  };
}

/**
 * SISP-57: stamps a completed request — install date, the (possibly
 * newly created) customer link, completedCustomerId, and the completion
 * record with its stockDeductedAt timestamp. Pure: returns the new
 * request list. Throws on an unknown id. Stamping an already-completed
 * request only refreshes its install date / delay reason — the stored
 * completion record and customer link are kept, never re-stamped, so
 * the stock deduction stays exactly-once.
 */
export function applyInstallCompletion(requests, plan, customer, stockDeductedAt) {
  const clean = sanitizeInstallRequests(requests);
  const index = clean.findIndex((r) => String(r.id) === String(plan?.requestId));
  if (index === -1) throw new Error('That installation request was not found.');
  const request = clean[index];
  const updated = { ...request, installDate: plan.installDate };
  if (plan.delayReason !== undefined) updated.delayReason = plan.delayReason;
  if (!cleanText(request.completedCustomerId)) {
    const done = customer && typeof customer === 'object' ? customer : {};
    updated.customerId = cleanText(done.id) || updated.customerId;
    updated.customerName = cleanText(done.name) || updated.customerName;
    updated.customerNumber = done.customerNumber === null || done.customerNumber === undefined || done.customerNumber === ''
      ? updated.customerNumber
      : done.customerNumber;
    updated.completedCustomerId = cleanText(done.id);
    updated.completion = sanitizeInstallCompletion({
      ...(plan.completion || {}),
      stockDeductedAt: typeof stockDeductedAt === 'string' && stockDeductedAt ? stockDeductedAt : new Date().toISOString()
    });
  }
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
export function setupInstallTrackerModal(getState, { onRequestsChanged, onToast, onConfirm, onCompleteInstall, getInstallStockContext } = {}) {
  const dialog = typeof document !== 'undefined' ? document.getElementById('installTrackerModal') : null;
  if (!dialog) return null;
  const $ = (id) => dialog.querySelector(`#${id}`);
  // Edit state: null while the form adds a new request; an id while it edits one.
  let editingRequestId = null;
  const getCustomers = () => {
    try {
      const state = typeof getState === 'function' ? getState() : null;
      return Array.isArray(state?.customers) ? state.customers : [];
    } catch {
      return [];
    }
  };

  // Delete confirmation via the app's own in-app dialog (injected as
  // onConfirm by app.js); never a silent delete. Falls back to the
  // browser confirm only where the app dialog is unavailable, and
  // refuses when neither exists.
  async function confirmDelete(title, subject) {
    if (typeof onConfirm === 'function') {
      return !!(await onConfirm({ tone: 'danger', title, subject, message: 'This cannot be undone from this device except by re-entering it.', confirmLabel: 'Delete' }));
    }
    if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
      return window.confirm(`${title}\n\n${subject}`);
    }
    if (typeof onToast === 'function') onToast('Delete needs confirmation — not available here.');
    return false;
  }

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

  // SISP-57: "Router ×1 · 2-Core Fiber Cable 120 m" style summary of a
  // completion's stock lines (deducted or skipped-with-warning alike).
  function stockSummaryText(lines) {
    return (Array.isArray(lines) ? lines : []).map((line) => {
      const meta = INSTALL_COMPLETION_STOCK.find((s) => s.itemId === line.itemId);
      const label = meta ? meta.label : line.itemId;
      return line.itemId === 'fiber-2core' ? `${label} ${line.qty} m` : `${label} ×${line.qty}`;
    }).join(' · ');
  }

  function refreshCustomerSelect() {
    const select = $('installRequestCustomer');
    if (!select) return;
    const prev = select.value;
    const placeholder = '<option value="">Not a customer yet — free-text name only</option>';
    let options = customerOptions(getCustomers(), $('installRequestCustomerSearch')?.value);
    // While editing an entry whose customer left the list, keep its
    // stored customer selectable so the edit does not silently unlink it.
    if (editingRequestId) {
      const editing = loadInstallRequests().find((r) => String(r.id) === String(editingRequestId));
      if (editing && editing.customerId && !getCustomers().some((c) => String(c.id) === String(editing.customerId))) {
        const label = `${editing.customerName || 'Unnamed'}${editing.customerNumber !== null && editing.customerNumber !== undefined ? ` (#${editing.customerNumber})` : ''} · not in list`;
        options += `<option value="${escapeHtml(String(editing.customerId))}">${escapeHtml(label)}</option>`;
      }
    }
    select.innerHTML = placeholder + options;
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
            ${r.completion ? `<p><span>${escapeHtml(t('instpipe_card_stock'))}</span><strong>${r.completion.stockDeductions.length ? escapeHtml(stockSummaryText(r.completion.stockDeductions)) : escapeHtml(t('instpipe_card_stock_none'))}</strong></p>` : ''}
            ${r.completion && r.completion.stockWarnings.length ? `<p><span>${escapeHtml(t('instpipe_card_warn'))}</span><strong>${escapeHtml(stockSummaryText(r.completion.stockWarnings))}</strong></p>` : ''}
            ${installed && (days || 0) > 0 ? `<p><span>Delay reason</span><strong>${escapeHtml(delayReasonLabel(r))}</strong></p>` : ''}
            <div class="install-tracker-card-actions"><button type="button" class="secondary-button" data-edit-request="${escapeHtml(String(r.id))}">✏️ Edit</button><button type="button" class="secondary-button danger" data-delete-request="${escapeHtml(String(r.id))}">🗑 Delete</button></div>
          </article>`;
        }).join('');
      listEl.querySelectorAll('[data-edit-request]').forEach((btn) => btn.addEventListener('click', () => {
        const request = loadInstallRequests().find((r) => String(r.id) === btn.dataset.editRequest);
        if (request) startRequestEdit(request);
      }));
      listEl.querySelectorAll('[data-delete-request]').forEach((btn) => btn.addEventListener('click', async () => {
        const request = loadInstallRequests().find((r) => String(r.id) === btn.dataset.deleteRequest);
        if (!request) return;
        const confirmed = await confirmDelete('Delete this request?', `${requestNameLabel(request)} · ${request.requestDate}`);
        if (!confirmed) return;
        try {
          saveInstallRequests(deleteInstallRequest(loadInstallRequests(), request.id));
          if (editingRequestId === request.id) cancelRequestEdit();
          render();
          if (typeof onRequestsChanged === 'function') onRequestsChanged();
          if (typeof onToast === 'function') onToast('Request deleted.');
        } catch (error) {
          if (typeof onToast === 'function') onToast(error.message || 'Could not delete request.');
        }
      }));
    }
    refreshCustomerSelect();
    refreshPendingSelect();
    const dateInput = $('installRequestDate');
    if (dateInput && !dateInput.value) dateInput.value = installTrackerToday();
    const markDateInput = $('installMarkDate');
    if (markDateInput && !markDateInput.value) markDateInput.value = installTrackerToday();
  }

  // Edit helpers: pre-fill the SAME form, swap the submit label, and
  // show a Cancel button that restores the add-new state. The stored
  // record is never touched until the edited form saves successfully.
  function setRequestSubmitMode() {
    const submit = $('installRequestForm')?.querySelector('button[type="submit"]');
    if (submit) submit.textContent = editingRequestId ? '💾 Changes save karein' : '➕ Request darj karein';
    const cancel = $('installRequestCancelEditBtn');
    if (cancel) cancel.hidden = !editingRequestId;
  }
  function startRequestEdit(request) {
    editingRequestId = request.id;
    const set = (id, value) => { const el = $(id); if (el) el.value = value ?? ''; };
    set('installRequestName', request.requesterName);
    refreshCustomerSelect();
    set('installRequestCustomer', request.customerId);
    set('installRequestPhone', request.phone);
    set('installRequestDate', request.requestDate);
    set('installRequestAmount', String(request.amountPaid));
    set('installRequestPayMethod', request.payMethod);
    set('installRequestPayReference', request.payReference);
    set('installRequestInstallDate', request.installDate);
    // Stored reason back into preset + custom: a preset stays a preset,
    // custom text returns under "Other", empty stays "No reason yet".
    const stored = request.delayReason || '';
    const preset = DELAY_REASON_PRESETS.includes(stored) && stored !== 'Other' ? stored : (stored ? 'Other' : '');
    set('installRequestReasonPreset', preset);
    set('installRequestReasonCustom', preset === 'Other' ? stored : '');
    setRequestSubmitMode();
    try { $('installRequestForm')?.scrollIntoView({ block: 'start' }); } catch { /* scroll is a nicety, never a failure */ }
  }
  function cancelRequestEdit() {
    editingRequestId = null;
    const requestForm = $('installRequestForm');
    if (requestForm) requestForm.reset();
    const dateInput = $('installRequestDate');
    if (dateInput) dateInput.value = installTrackerToday();
    refreshCustomerSelect();
    setRequestSubmitMode();
  }
  // Closing the modal abandons any in-progress edit, so reopening
  // always starts from a clean add-new form.
  dialog.addEventListener('close', () => {
    if (editingRequestId) cancelRequestEdit();
  });

  const searchInput = $('installRequestCustomerSearch');
  if (searchInput) searchInput.addEventListener('input', refreshCustomerSelect);
  const monthInput = $('installTrackerMonth');
  if (monthInput) monthInput.addEventListener('change', render);

  const form = $('installRequestForm');
  if (form) {
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      try {
        const input = {
          requesterName: $('installRequestName')?.value,
          customerId: $('installRequestCustomer')?.value,
          phone: $('installRequestPhone')?.value,
          requestDate: $('installRequestDate')?.value,
          amountPaid: $('installRequestAmount')?.value,
          payMethod: $('installRequestPayMethod')?.value,
          payReference: $('installRequestPayReference')?.value,
          installDate: $('installRequestInstallDate')?.value,
          delayReason: resolveDelayReason($('installRequestReasonPreset')?.value, $('installRequestReasonCustom')?.value)
        };
        const wasEditing = editingRequestId;
        const updated = wasEditing
          ? updateInstallRequest(loadInstallRequests(), wasEditing, input, { customers: getCustomers() })
          : addInstallRequest(loadInstallRequests(), input, { customers: getCustomers() });
        saveInstallRequests(updated);
        if (wasEditing) {
          cancelRequestEdit();
        } else {
          form.reset();
          const dateInput = $('installRequestDate');
          if (dateInput) dateInput.value = installTrackerToday();
        }
        render();
        if (typeof onRequestsChanged === 'function') onRequestsChanged();
        if (typeof onToast === 'function') onToast(wasEditing ? 'Request updated.' : 'Installation request recorded.');
      } catch (error) {
        if (typeof onToast === 'function') onToast(error.message || 'Could not record request.');
      }
    });
  }
  const requestCancelBtn = $('installRequestCancelEditBtn');
  if (requestCancelBtn) requestCancelBtn.addEventListener('click', cancelRequestEdit);
  const markForm = $('installMarkForm');
  if (markForm) {
    markForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      try {
        const reason = resolveDelayReason($('installMarkReasonPreset')?.value, $('installMarkReasonCustom')?.value);
        const requests = loadInstallRequests();
        const request = requests.find((r) => String(r.id) === String($('installMarkRequest')?.value));
        if (!request) throw new Error('That installation request was not found.');
        // SISP-57: the mark-installed action IS the completion pipeline.
        // The plan is built against the LIVE customer list plus the
        // stock context (movements + catalog ids) the app injects via
        // getInstallStockContext, then executed by onCompleteInstall
        // (customer create/link + stock-out through addMovement). The
        // request is stamped only after the handler succeeds, so a
        // failed completion leaves the request pending. Without the
        // handler the modal falls back to the plain mark-installed
        // behaviour (no customer, no stock writes).
        let updated;
        let toastMessage = 'Connection marked installed.';
        if (typeof onCompleteInstall === 'function') {
          const stockContext = typeof getInstallStockContext === 'function'
            ? (getInstallStockContext() || {})
            : {};
          const plan = buildInstallCompletionPlan(request, {
            installDate: $('installMarkDate')?.value,
            ...(reason ? { delayReason: reason } : {}),
            connectionFee: $('installMarkConnectionFee')?.value,
            routerModel: $('installMarkRouterModel')?.value,
            routerPrice: $('installMarkRouterPrice')?.value,
            fiberMeters: $('installMarkFiberMeters')?.value,
            routerQty: $('installMarkRouterQty')?.value,
            mediaConverterQty: $('installMarkMediaQty')?.value
          }, {
            customers: getCustomers(),
            movements: stockContext.movements ?? null,
            inventoryItemIds: stockContext.inventoryItemIds ?? null
          });
          const result = await onCompleteInstall(plan);
          const customer = result && typeof result === 'object' ? result.customer : null;
          if (!customer || !cleanText(customer.id)) throw new Error('Completion did not return a customer.');
          updated = applyInstallCompletion(requests, plan, customer);
          toastMessage = plan.alreadyCompleted
            ? t('instpipe_already_toast')
            : t('instpipe_done_toast', null, { name: customer.name || plan.customerName });
          if (!plan.alreadyCompleted && plan.warnings.length) {
            toastMessage += ` ⚠ ${t('instpipe_stock_warn_toast', null, { items: stockSummaryText(plan.warnings) })}`;
          }
        } else {
          updated = markInstallRequestInstalled(requests, request.id, {
            installDate: $('installMarkDate')?.value,
            ...(reason ? { delayReason: reason } : {})
          });
        }
        saveInstallRequests(updated);
        markForm.reset();
        const markDateInput = $('installMarkDate');
        if (markDateInput) markDateInput.value = installTrackerToday();
        render();
        if (typeof onRequestsChanged === 'function') onRequestsChanged();
        if (typeof onToast === 'function') onToast(toastMessage);
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
