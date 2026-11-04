// Plan 174 (Plan 101-202) — Preferred visit time window record.
//
// Field visits arrive at whatever hour suits the route, so a
// customer who works mornings or evenings keeps missing the
// collector, and repeat visits waste Saad's day. This module
// records one preferred-window record per customer — morning,
// afternoon, evening, or any-time, plus an optional plain-words
// note such as "after school run" — used only to order and
// suggest visit times.
//
// What this module is NOT, stated plainly:
//   - It is not a booking and not a promise. A recorded window
//     never blocks a visit outside the window when the customer
//     is actually available, and a visit is never created here.
//   - It is not a visit outcome, bill, payment, or ticket record.
//     Recording, editing, or removing a window never changes any
//     visit outcome, bill, payment, or ticket, and this module
//     never reads or writes one.
//   - It never sends anything. There is no message, no call, and
//     no notification of any kind.
//   - It never assumes a window. A customer with no recorded
//     window is shown as any-time, and an unrecognised window
//     value is stored as any-time, never guessed as a specific
//     part of the day.
//
// How the module keeps those fences:
//   - It is pure and import-free: the caller supplies every
//     record, and the module never reads storage, the clock, or
//     the network, and never mutates an input.
//   - A record with no id or no customer is refused outright.
//     Unknown fields are dropped, so a record can never grow a
//     visit-outcome, bill, payment, ticket, booking, or sending
//     field.
//   - One record per customer (case-insensitive): a second
//     record for the same customer with a different id is
//     refused outright. To record a customer again, the operator
//     removes the old record first.
//   - A duplicate id is never rewritten by recording: an
//     identical re-save leaves the list unchanged, and a re-save
//     with different figures also leaves the list unchanged.
//     Changing a window goes only through updateVisitWindow,
//     which keeps the id and the customer and replaces only the
//     window and the note.

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function cleanKey(value) {
  return cleanText(value).toLowerCase();
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

// The only windows a record may carry. The order below is also
// the order a visit queue is sorted in: morning first, then
// afternoon, then evening, then any-time last.
export const VISIT_WINDOWS = ['morning', 'afternoon', 'evening', 'any-time'];

export const VISIT_WINDOW_LABELS = {
  morning: 'Morning',
  afternoon: 'Afternoon',
  evening: 'Evening',
  'any-time': 'Any time',
};

function cleanWindow(value) {
  const key = cleanKey(value);
  return VISIT_WINDOWS.includes(key) ? key : 'any-time';
}

export function normalizeVisitWindow(value) {
  if (!value || typeof value !== 'object') return null;
  const id = cleanText(value.id);
  const customerId = cleanText(value.customerId);
  if (!id || !customerId) return null;
  return {
    id,
    customerId,
    window: cleanWindow(value.window),
    note: cleanText(value.note),
  };
}

export function normalizeVisitWindowList(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const item of list) {
    const record = normalizeVisitWindow(item);
    if (record) out.push(record);
  }
  return out;
}

export function findVisitWindow(list, id) {
  const records = normalizeVisitWindowList(list);
  const key = cleanText(id);
  return records.find((record) => record.id === key) ?? null;
}

export function recordVisitWindow(list, record) {
  const records = normalizeVisitWindowList(list);
  const next = normalizeVisitWindow(record);
  if (!next) return records;
  if (records.some((item) => item.id === next.id)) return records;
  if (records.some((item) => cleanKey(item.customerId) === cleanKey(next.customerId))) return records;
  return [...records, next];
}

// Editing replaces only the window and the note. The id and the
// customer never move, so an edit can never retarget a record at
// a different customer or merge two customers' records.
export function updateVisitWindow(list, id, patch) {
  const records = normalizeVisitWindowList(list);
  const key = cleanText(id);
  if (!patch || typeof patch !== 'object') return records;
  return records.map((record) => {
    if (record.id !== key) return record;
    const updated = { ...record };
    if (patch.window !== undefined) updated.window = cleanWindow(patch.window);
    if (patch.note !== undefined) updated.note = cleanText(patch.note);
    return updated;
  });
}

export function removeVisitWindow(list, id) {
  const records = normalizeVisitWindowList(list);
  const key = cleanText(id);
  return records.filter((record) => record.id !== key);
}

// A customer's preferred window, or 'any-time' when no record
// exists — never a guessed part of the day.
export function visitWindowForCustomer(list, customerId) {
  const records = normalizeVisitWindowList(list);
  const key = cleanKey(customerId);
  const found = records.find((record) => cleanKey(record.customerId) === key);
  return found ? found.window : 'any-time';
}

export function visitWindowCustomers(list) {
  const seen = new Map();
  for (const record of normalizeVisitWindowList(list)) {
    const key = cleanKey(record.customerId);
    if (!seen.has(key)) seen.set(key, record.customerId);
  }
  return [...seen.values()].sort((a, b) => (cleanKey(a) < cleanKey(b) ? -1 : 1));
}

// Records for one window only. Filtering by 'any-time' also
// returns nothing extra: it returns only recorded any-time
// records, never invented ones.
export function visitWindowsForWindow(list, window) {
  const key = cleanWindow(window);
  return normalizeVisitWindowList(list).filter((record) => record.window === key);
}

// Order a visit queue by preferred window on the same fixture:
// every supplied customer id comes back exactly once, each with
// its resolved window (unrecorded customers resolve to
// any-time), sorted morning, afternoon, evening, any-time, then
// customer A-Z within each window. Nothing is dropped, nothing
// is booked, and no visit is created.
export function orderCustomersByWindow(list, customerIds) {
  const records = normalizeVisitWindowList(list);
  const byCustomer = new Map();
  for (const record of records) {
    const key = cleanKey(record.customerId);
    if (!byCustomer.has(key)) byCustomer.set(key, record);
  }
  const out = [];
  const seen = new Set();
  for (const raw of Array.isArray(customerIds) ? customerIds : []) {
    const customerId = cleanText(raw);
    if (!customerId) continue;
    const key = cleanKey(customerId);
    if (seen.has(key)) continue;
    seen.add(key);
    const record = byCustomer.get(key);
    out.push({
      customerId,
      window: record ? record.window : 'any-time',
      note: record ? record.note : '',
    });
  }
  const order = { morning: 0, afternoon: 1, evening: 2, 'any-time': 3 };
  return out.sort((a, b) => {
    if (order[a.window] !== order[b.window]) return order[a.window] - order[b.window];
    return cleanKey(a.customerId) < cleanKey(b.customerId) ? -1 : 1;
  });
}

export function visitWindowText(record) {
  const item = normalizeVisitWindow(record);
  if (!item) return '';
  const noteText = item.note ? ` Note: ${item.note}` : '';
  return `Preferred visit window for ${item.customerId}: ${VISIT_WINDOW_LABELS[item.window]}.${noteText} This is a preference only, not a booking or a promise.`;
}

export function visitWindowSummaryText(list) {
  const records = normalizeVisitWindowList(list);
  const customers = visitWindowCustomers(list);
  return `${records.length} preferred visit window${records.length === 1 ? '' : 's'} for ${customers.length} customer${customers.length === 1 ? '' : 's'}`;
}

export function visitWindowHtml(record) {
  const item = normalizeVisitWindow(record);
  if (!item) return '';
  return `<p><strong>${escapeHtml(item.customerId)}</strong> · ${escapeHtml(visitWindowText(item))} <small>(${escapeHtml(item.id)})</small></p>`;
}

export function visitWindowAllHtml(list) {
  const records = normalizeVisitWindowList(list);
  if (records.length === 0) return '<p>No preferred visit windows recorded.</p>';
  const sorted = [...records].sort((a, b) => (cleanKey(a.customerId) < cleanKey(b.customerId) ? -1 : 1));
  return sorted.map((record) => visitWindowHtml(record)).join('');
}

// Order-preserving render for the visit queue view: records are
// shown in the order the caller supplies (window order), not
// re-sorted A-Z, so the queue order is visible as ordered.
export function visitWindowOrderedHtml(list) {
  const records = normalizeVisitWindowList(list);
  if (records.length === 0) return '<p>No preferred visit windows recorded.</p>';
  return records.map((record) => visitWindowHtml(record)).join('');
}

export function visitWindowCsv(list) {
  const rows = [['id', 'customer', 'window', 'note']];
  for (const record of normalizeVisitWindowList(list)) {
    rows.push([record.id, record.customerId, record.window, record.note]);
  }
  return rows.map((row) => row.map(csvCell).join(',')).join('\n');
}

export function visitWindowFilename() {
  return 'shahdara_visit_windows.csv';
}
