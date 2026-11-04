// Plan 56 (Plan 1-100) — At-risk customer signals list (read-only).
//
// READ-ONLY. This module composes one at-risk list from records the
// caller already has — payment lateness over recent months, repeat
// faults (Plan 24), unhappy satisfaction notes (Plan 49), and a long
// gap since the last recorded payment or ticket activity — so a
// customer quietly drifting away is seen before they leave, instead
// of only after they have gone.
//
// It predicts; it does not act. It takes no automatic action, sends
// no message, and changes no billing, ticket, Waada, or lifecycle
// record. A customer appears on the list exactly when at least one
// operator-set threshold is met, with the signals that triggered it
// shown. Clearing a signal (for example a payment made on time)
// removes that signal from the list, because the list is recomputed
// fresh from the current records on every call — nothing here is
// stored as a flag.
//
// This is deliberately NOT Plan 8 (alerts inbox): Plan 8 alerts on
// thresholds already crossed on existing records (Waada overdue 7+
// days, suspense unclaimed 30+ days, a large single outstanding
// balance). Plan 56 predicts future risk from drift and gaps. The
// two share the idea of one visible thresholds place in the
// Analytics panel and the same normalisation pattern (an invalid
// threshold falls back to its default, never to a zero threshold
// that would flag everyone) — not one engine and not one store,
// because their thresholds measure different things.
//
// The module is import-free by design (like alerts-inbox.js and
// repeat-fault-flag.js), so it can be used without pulling in the
// app graph. The caller supplies the records and the thresholds;
// the module never reads a record, never reads the clock, and never
// mutates its inputs.
//
// Input shapes:
//   customers:        { id, name, mohalla? } (mohalla is display only)
//   paymentLateness:  { customerId, latenessDays: [number, ...] }
//                     — lateness per settled bill month, oldest
//                     first; a negative value is an early payment
//                     and counts toward the average, so paying on
//                     time can clear the signal. A month with no
//                     payment is not lateness and is never passed in
//                     (an unpaid bill is Plan 12's territory).
//   repeatFaults:     { customerId, count? } | customerId string
//                     — the Plan 24 flags for this customer, or just
//                     the flagged customer ids.
//   satisfactionNotes:{ customerId, rating } — Plan 49 notes joined
//                     to their ticket's customer; only 'unhappy'
//                     signals.
//   lastActivity:     { customerId, lastDate } — the latest recorded
//                     payment or ticket date for the customer, as
//                     YYYY-MM-DD. No dedicated contact log exists,
//                     so the gap measures last recorded payment or
//                     ticket activity, and the panel copy says so.
//   today:            YYYY-MM-DD, the "as of" date for gap math.
// Thresholds: { lateDays, recentMonths, minLateMonths, gapDays }.

export const AT_RISK_SIGNAL_TYPES = Object.freeze({
  PAYMENT_LATE_DRIFT: 'payment_late_drift',
  REPEAT_FAULTS: 'repeat_faults',
  UNHAPPY: 'unhappy',
  CONTACT_GAP: 'contact_gap',
});

export const AT_RISK_SIGNAL_LABELS = Object.freeze({
  [AT_RISK_SIGNAL_TYPES.PAYMENT_LATE_DRIFT]: 'Payment lateness drifting',
  [AT_RISK_SIGNAL_TYPES.REPEAT_FAULTS]: 'Repeat faults',
  [AT_RISK_SIGNAL_TYPES.UNHAPPY]: 'Unhappy after a fix',
  [AT_RISK_SIGNAL_TYPES.CONTACT_GAP]: 'Long gap since last activity',
});

export const DEFAULT_AT_RISK_THRESHOLDS = Object.freeze({
  // Average lateness (days) over the recent window that counts as drift.
  lateDays: 7,
  // How many recent settled months form the lateness window.
  recentMonths: 3,
  // How many of those months must actually be late (> 0 days).
  minLateMonths: 2,
  // Days since the last recorded payment or ticket activity that
  // counts as a long gap.
  gapDays: 60,
});

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function asFiniteNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

// Strict YYYY-MM-DD calendar-date check (no rollover: 2026-02-30
// is not a date, and neither is 2026-13-01).
export function validAtRiskDate(value) {
  if (typeof value !== 'string') return false;
  const match = DATE_RE.exec(value.trim());
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const built = new Date(Date.UTC(year, month - 1, day));
  return (
    built.getUTCFullYear() === year &&
    built.getUTCMonth() === month - 1 &&
    built.getUTCDate() === day
  );
}

function dateParts(dateStr) {
  if (!validAtRiskDate(dateStr)) return null;
  const [year, month, day] = dateStr.trim().split('-').map(Number);
  return { year, month, day };
}

// Whole UTC calendar days between two valid dates (later minus
// earlier); null when either date is invalid.
function daysBetween(earlierStr, laterStr) {
  const earlier = dateParts(earlierStr);
  const later = dateParts(laterStr);
  if (!earlier || !later) return null;
  const earlierMs = Date.UTC(earlier.year, earlier.month - 1, earlier.day);
  const laterMs = Date.UTC(later.year, later.month - 1, later.day);
  return Math.round((laterMs - earlierMs) / 86400000);
}

function asWholePositive(value, fallback) {
  const n = asFiniteNumber(value);
  if (n === null || !Number.isInteger(n) || n <= 0) return fallback;
  return n;
}

// Normalise operator thresholds. An invalid value falls back to
// its default — a zero or negative threshold would flag everyone,
// so it never survives normalisation.
export function normalizeAtRiskThresholds(input) {
  const raw = isPlainObject(input) ? input : {};
  return {
    lateDays: asWholePositive(raw.lateDays, DEFAULT_AT_RISK_THRESHOLDS.lateDays),
    recentMonths: asWholePositive(raw.recentMonths, DEFAULT_AT_RISK_THRESHOLDS.recentMonths),
    minLateMonths: asWholePositive(raw.minLateMonths, DEFAULT_AT_RISK_THRESHOLDS.minLateMonths),
    gapDays: asWholePositive(raw.gapDays, DEFAULT_AT_RISK_THRESHOLDS.gapDays),
  };
}

function customerKey(customer) {
  const id = text(customer?.id);
  return id === '' ? null : id;
}

function customerName(customer) {
  const name = text(customer?.name) || text(customer?.customerName);
  return name === '' ? (customerKey(customer) ?? 'Unknown') : name;
}

// Payment-lateness signal. Window = the last `recentMonths`
// lateness values (oldest first in the input, so the tail is the
// window). Signals when at least `minLateMonths` of the window are
// late (> 0 days) AND the window average is at least `lateDays`.
// The detail names the actual values, so the operator sees the
// drift instead of trusting a bare flag.
function paymentLateSignal(latenessDays, thresholds) {
  const values = (Array.isArray(latenessDays) ? latenessDays : [])
    .map(asFiniteNumber)
    .filter((n) => n !== null)
    .slice(-thresholds.recentMonths);
  if (values.length === 0) return null;
  const lateCount = values.filter((n) => n > 0).length;
  if (lateCount < thresholds.minLateMonths) return null;
  const average = values.reduce((sum, n) => sum + n, 0) / values.length;
  if (average < thresholds.lateDays) return null;
  return {
    type: AT_RISK_SIGNAL_TYPES.PAYMENT_LATE_DRIFT,
    label: AT_RISK_SIGNAL_LABELS[AT_RISK_SIGNAL_TYPES.PAYMENT_LATE_DRIFT],
    detail:
      `Average ${average.toFixed(1)} days late over the last ${values.length} settled ` +
      `month${values.length === 1 ? '' : 's'} (${values.map((n) => `${n} days`).join(', ')}); ` +
      `${lateCount} late month${lateCount === 1 ? '' : 's'}`,
  };
}

function repeatFaultSignal(count) {
  if (count === null) {
    return {
      type: AT_RISK_SIGNAL_TYPES.REPEAT_FAULTS,
      label: AT_RISK_SIGNAL_LABELS[AT_RISK_SIGNAL_TYPES.REPEAT_FAULTS],
      detail: 'Flagged for repeat faults (Plan 24)',
    };
  }
  return {
    type: AT_RISK_SIGNAL_TYPES.REPEAT_FAULTS,
    label: AT_RISK_SIGNAL_LABELS[AT_RISK_SIGNAL_TYPES.REPEAT_FAULTS],
    detail: `${count} tickets in the same category inside the repeat-fault window (Plan 24)`,
  };
}

function unhappySignal() {
  return {
    type: AT_RISK_SIGNAL_TYPES.UNHAPPY,
    label: AT_RISK_SIGNAL_LABELS[AT_RISK_SIGNAL_TYPES.UNHAPPY],
    detail: 'Unhappy satisfaction note after a resolved ticket (Plan 49)',
  };
}

function contactGapSignal(lastDate, today, thresholds) {
  if (!validAtRiskDate(lastDate) || !validAtRiskDate(today)) return null;
  const gap = daysBetween(lastDate, today);
  if (gap === null || gap < thresholds.gapDays) return null;
  return {
    type: AT_RISK_SIGNAL_TYPES.CONTACT_GAP,
    label: AT_RISK_SIGNAL_LABELS[AT_RISK_SIGNAL_TYPES.CONTACT_GAP],
    detail: `${gap} days since the last recorded payment or ticket activity (${lastDate.trim()})`,
  };
}

// Build the at-risk list. A customer appears exactly when at least
// one signal triggers; rows sort by signal count (most signals
// first), then name A–Z, then id. Inputs are never mutated, and no
// record of any kind is written.
export function buildAtRiskList({
  customers = [],
  paymentLateness = [],
  repeatFaults = [],
  satisfactionNotes = [],
  lastActivity = [],
  thresholds: thresholdsInput,
  today,
} = {}) {
  const thresholds = normalizeAtRiskThresholds(thresholdsInput);
  const latenessByCustomer = new Map();
  for (const entry of Array.isArray(paymentLateness) ? paymentLateness : []) {
    if (!isPlainObject(entry)) continue;
    const key = text(entry.customerId);
    if (key === '') continue;
    latenessByCustomer.set(key, entry.latenessDays);
  }
  const repeatByCustomer = new Map();
  for (const entry of Array.isArray(repeatFaults) ? repeatFaults : []) {
    if (typeof entry === 'string') {
      const key = text(entry);
      if (key !== '' && !repeatByCustomer.has(key)) repeatByCustomer.set(key, null);
      continue;
    }
    if (!isPlainObject(entry)) continue;
    const key = text(entry.customerId);
    if (key === '') continue;
    const count = asFiniteNumber(entry.count);
    if (!repeatByCustomer.has(key) || (count !== null && repeatByCustomer.get(key) === null)) {
      repeatByCustomer.set(key, count);
    }
  }
  const unhappyCustomers = new Set();
  for (const note of Array.isArray(satisfactionNotes) ? satisfactionNotes : []) {
    if (!isPlainObject(note)) continue;
    if (text(note.rating) !== 'unhappy') continue;
    const key = text(note.customerId);
    if (key !== '') unhappyCustomers.add(key);
  }
  const activityByCustomer = new Map();
  for (const entry of Array.isArray(lastActivity) ? lastActivity : []) {
    if (!isPlainObject(entry)) continue;
    const key = text(entry.customerId);
    if (key === '' || !validAtRiskDate(entry.lastDate)) continue;
    const previous = activityByCustomer.get(key);
    if (!previous || entry.lastDate.trim() > previous) {
      activityByCustomer.set(key, entry.lastDate.trim());
    }
  }

  const rows = [];
  for (const customer of Array.isArray(customers) ? customers : []) {
    if (!isPlainObject(customer)) continue;
    const key = customerKey(customer);
    if (key === null) continue;
    const signals = [];
    const late = paymentLateSignal(latenessByCustomer.get(key), thresholds);
    if (late) signals.push(late);
    if (repeatByCustomer.has(key)) signals.push(repeatFaultSignal(repeatByCustomer.get(key)));
    if (unhappyCustomers.has(key)) signals.push(unhappySignal());
    const gap = contactGapSignal(activityByCustomer.get(key), today, thresholds);
    if (gap) signals.push(gap);
    if (signals.length === 0) continue;
    rows.push({
      customerId: key,
      customerName: customerName(customer),
      mohalla: text(customer.mohalla) || text(customer.area) || '',
      signals,
      signalCount: signals.length,
    });
  }
  rows.sort((a, b) => {
    if (b.signalCount !== a.signalCount) return b.signalCount - a.signalCount;
    const name = a.customerName.localeCompare(b.customerName);
    if (name !== 0) return name;
    return a.customerId.localeCompare(b.customerId);
  });
  return { thresholds, today: validAtRiskDate(today) ? today.trim() : null, rows };
}

export function atRiskSummaryText(view) {
  if (!view || !Array.isArray(view.rows)) return 'No at-risk view.';
  if (view.rows.length === 0) return 'No customer meets an at-risk threshold right now.';
  const signalTotal = view.rows.reduce((sum, row) => sum + row.signalCount, 0);
  return (
    `${view.rows.length} at-risk customer${view.rows.length === 1 ? '' : 's'}, ` +
    `${signalTotal} signal${signalTotal === 1 ? '' : 's'} in total.`
  );
}

function escapeAtRiskHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function csvCell(value) {
  const str = String(value ?? '');
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

export function atRiskHtml(view) {
  if (!view || !Array.isArray(view.rows) || view.rows.length === 0) {
    return '<p class="empty-state">No customer meets an at-risk threshold right now.</p>';
  }
  const rowsHtml = view.rows
    .map((row) => {
      const signalsHtml = row.signals
        .map((s) => `<li><strong>${escapeAtRiskHtml(s.label)}</strong> — ${escapeAtRiskHtml(s.detail)}</li>`)
        .join('');
      return (
        `<div style="margin-bottom: 10px;"><strong>${escapeAtRiskHtml(row.customerName)}</strong>` +
        `${row.mohalla ? ` · ${escapeAtRiskHtml(row.mohalla)}` : ''} ` +
        `(${row.signalCount} signal${row.signalCount === 1 ? '' : 's'}) ` +
        `<button class="secondary-button btn-sm" type="button" style="font-size: 11px; padding: 4px 10px;" data-at-risk-customer-id="${escapeAtRiskHtml(row.customerId)}">Open profile</button>` +
        `<ul style="margin: 4px 0;">${signalsHtml}</ul></div>`
      );
    })
    .join('');
  return (
    `<p style="font-size: 12px;">Read-only: flagging never changes a payment, Waada, ticket, or customer status. ` +
    `Visit the right doors before a quiet drift becomes a disconnection.</p>${rowsHtml}`
  );
}

export function atRiskCsv(view) {
  const header = 'customerId,customerName,mohalla,signalCount,signals';
  if (!view || !Array.isArray(view.rows)) return header;
  const lines = view.rows.map((row) =>
    [
      csvCell(row.customerId),
      csvCell(row.customerName),
      csvCell(row.mohalla),
      csvCell(row.signalCount),
      csvCell(row.signals.map((s) => `${s.label}: ${s.detail}`).join('; ')),
    ].join(',')
  );
  return [header, ...lines].join('\n');
}

export function atRiskFilename() {
  return 'at-risk-signals.csv';
}
