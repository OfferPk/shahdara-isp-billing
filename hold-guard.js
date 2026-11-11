// Plan 86 (Plan 1-100) — Hold history and fair-use guard (limits,
// visible, operator-set).
//
// Without limits, a hold meant for a genuine absence can be used
// again and again, quietly turning a paying customer into a
// permanently paused one while the port and ONU sit idle. This
// module adds only the guardrails and the history view: three
// operator-set limits (maximum hold length, maximum holds per
// customer per year, minimum active period between holds) plus a
// read-only per-customer hold history drawn from the vacation
// holds (Plan 82) and the move-house pauses (Plan 85).
//
// The fences, stated plainly:
//   - The guardrails warn; they never block by themselves. A new
//     hold that exceeds a limit shows the limit, the history,
//     and a reason field before it can be saved — and exceeding
//     a limit without a recorded reason is not possible: the
//     check only allows the save when no limit is exceeded or
//     when the operator has recorded a reason. The reason is
//     kept in this plan's own override log, never written onto
//     the hold record itself.
//   - Guardrail settings and history views never alter any bill,
//     payment, or hold record. This module holds no bill,
//     payment, or package field, never touches a hold, move, or
//     customer record, and never deletes a hold: it reads the
//     caller-supplied lists and returns fresh views.
//   - Dates are strict YYYY-MM-DD calendar dates (2026-02-30
//     is not a date). A limit that is unset, zero, negative, or
//     not a number is treated as unset — never as zero, which
//     would forbid every hold. Inputs are never mutated, and
//     the module never reads storage, the clock, or the network.

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export const GUARD_REASONS = ['away', 'seasonal_residence', 'other', 'move'];

export const GUARD_REASON_LABELS = {
  away: 'Away',
  seasonal_residence: 'Seasonal residence',
  other: 'Other',
  move: 'Move house',
};

export const GUARD_TREATMENTS = ['no_bill', 'retention'];

export const GUARD_TREATMENT_LABELS = {
  no_bill: 'No bill raised',
  retention: 'Retention charge only',
};

export const GUARD_KINDS = ['hold', 'move'];

export const GUARD_KIND_LABELS = {
  hold: 'Hold',
  move: 'Move pause',
};

const MOHALLA_ALIASES = {
  bani: 'BANII',
  banii: 'BANII',
  kishti: 'KISHTII',
  kishtii: 'KISHTII',
  chamyaa: 'CHAMYAAA',
  chamyaaa: 'CHAMYAAA',
  // Owner-confirmed 2026-11-11: JABBIYAAA is the same mohalla as
  // JABBIYAA. Charyaa is NOT an alias — it is its own mohalla.
  jabbiyaaa: 'JABBIYAA',
};

function text(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function escapeHtml(value) {
  return text(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function csvCell(value) {
  const raw = text(value);
  if (/[",\n]/.test(raw)) return `"${raw.replace(/"/g, '""')}"`;
  return raw;
}

export function validGuardDate(value) {
  const raw = text(value);
  if (!raw) return null;
  const datePart = raw.slice(0, 10);
  if (!DATE_RE.test(datePart)) return null;
  const [year, month, day] = datePart.split('-').map(Number);
  const built = new Date(Date.UTC(year, month - 1, day));
  if (built.getUTCFullYear() !== year || built.getUTCMonth() !== month - 1 || built.getUTCDate() !== day) return null;
  return datePart;
}

function daysBetween(from, to) {
  const [fy, fm, fd] = from.split('-').map(Number);
  const [ty, tm, td] = to.split('-').map(Number);
  const start = Date.UTC(fy, fm - 1, fd);
  const end = Date.UTC(ty, tm - 1, td);
  return Math.round((end - start) / 86400000);
}

function pad(value) {
  return String(value).padStart(2, '0');
}

export function guardMohallaKey(value) {
  const raw = text(value).replace(/^mohalla\s+/i, '').toLowerCase();
  if (!raw) return '';
  return MOHALLA_ALIASES[raw] ?? text(value).replace(/^mohalla\s+/i, '');
}

export function guardMohallaLabel(value) {
  return text(value).replace(/^mohalla\s+/i, '');
}

function toCents(raw) {
  if (raw === null || raw === undefined || raw === '') return null;
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw)) return null;
    return Math.round(raw);
  }
  const cleaned = String(raw).replace(/,/g, '').trim();
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
  return Math.round(Number(cleaned) * 100);
}

function centsOf(record) {
  if (record.retentionCents !== undefined && record.retentionCents !== null && record.retentionCents !== '') {
    const cents = Number(record.retentionCents);
    if (Number.isFinite(cents)) return Math.round(cents);
    return null;
  }
  return toCents(record.retentionAmount ?? record.retentionCharge);
}

function formatGuardAmount(cents) {
  if (cents === null || cents === undefined || !Number.isFinite(cents)) return '';
  const sign = cents < 0 ? '-' : '';
  const whole = Math.floor(Math.abs(cents) / 100);
  const part = pad(Math.abs(cents) % 100);
  return `${sign}Rs. ${whole}.${part}`;
}

// One history entry per hold or move pause. A hold keeps its
// Plan 82 reason; a move pause is labelled "Move house" because
// the move record carries no away/seasonal reason of its own.
// The entry's end date is the actual return/reconnect date once
// ended, otherwise the expected date — the span the port sat
// idle, as far as the record knows it.
function historyEntryFromHold(raw) {
  const id = text(raw.id);
  const customerId = text(raw.customerId);
  const startDate = validGuardDate(raw.startDate);
  const expectedEndDate = validGuardDate(raw.expectedReturnDate);
  const reason = text(raw.reason);
  const treatment = text(raw.treatment);
  const status = text(raw.status);
  if (!id || !customerId || !startDate || !expectedEndDate) return null;
  if (expectedEndDate <= startDate) return null;
  if (!GUARD_REASONS.includes(reason) || reason === 'move') return null;
  if (!GUARD_TREATMENTS.includes(treatment)) return null;
  if (status !== 'active' && status !== 'ended') return null;
  let actualEndDate = '';
  if (status === 'ended') {
    actualEndDate = validGuardDate(raw.actualReturnDate);
    if (!actualEndDate || actualEndDate < startDate) return null;
  }
  return {
    id,
    customerId,
    customerName: text(raw.customerName),
    kind: 'hold',
    startDate,
    expectedEndDate,
    actualEndDate,
    endDate: actualEndDate || expectedEndDate,
    reason,
    treatment,
    retentionCents: treatment === 'retention' ? centsOf(raw) : null,
    status,
    mohalla: guardMohallaLabel(raw.mohalla),
    mohallaKey: guardMohallaKey(raw.mohalla),
    oldMohalla: '',
    newMohalla: '',
  };
}

function historyEntryFromMove(raw) {
  const id = text(raw.id);
  const customerId = text(raw.customerId);
  const startDate = validGuardDate(raw.pauseStartDate);
  const expectedEndDate = validGuardDate(raw.expectedReconnectDate);
  const treatment = text(raw.treatment);
  const status = text(raw.status);
  if (!id || !customerId || !startDate || !expectedEndDate) return null;
  if (expectedEndDate <= startDate) return null;
  if (!GUARD_TREATMENTS.includes(treatment)) return null;
  if (status !== 'pending' && status !== 'reconnected') return null;
  let actualEndDate = '';
  if (status === 'reconnected') {
    actualEndDate = validGuardDate(raw.actualReconnectDate);
    if (!actualEndDate || actualEndDate < startDate) return null;
  }
  return {
    id,
    customerId,
    customerName: text(raw.customerName),
    kind: 'move',
    startDate,
    expectedEndDate,
    actualEndDate,
    endDate: actualEndDate || expectedEndDate,
    reason: 'move',
    treatment,
    retentionCents: treatment === 'retention' ? centsOf(raw) : null,
    status,
    mohalla: guardMohallaLabel(raw.newMohalla),
    mohallaKey: guardMohallaKey(raw.newMohalla),
    oldMohalla: guardMohallaLabel(raw.oldMohalla),
    newMohalla: guardMohallaLabel(raw.newMohalla),
  };
}

function byStartThenId(a, b) {
  if (a.startDate !== b.startDate) return a.startDate < b.startDate ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

// The full hold history for every customer, oldest first: every
// Plan 82 hold and every Plan 85 move pause, in date order.
// Records that are not well-formed are dropped, never guessed.
export function buildHoldHistory(holds, moves) {
  const entries = [];
  if (Array.isArray(holds)) {
    for (const raw of holds) {
      const entry = historyEntryFromHold(raw);
      if (entry) entries.push(entry);
    }
  }
  if (Array.isArray(moves)) {
    for (const raw of moves) {
      const entry = historyEntryFromMove(raw);
      if (entry) entries.push(entry);
    }
  }
  return entries.sort(byStartThenId);
}

export function historyForCustomer(history, customerId) {
  if (!Array.isArray(history)) return [];
  const wanted = text(customerId);
  if (!wanted) return [];
  return history.filter((entry) => entry.customerId === wanted).sort(byStartThenId);
}

// Operator-set limits. Each limit is a positive whole number or
// null (unset). Zero, negative, fractional, and non-numeric
// values are unset, never zero: a zero maximum would forbid
// every hold, which is not a limit the operator set.
export function normalizeGuardSettings(raw) {
  if (!raw || typeof raw !== 'object') return { maxHoldDays: null, maxHoldsPerYear: null, minActiveDays: null };
  const limit = (value) => {
    if (value === null || value === undefined || value === '') return null;
    const num = Number(value);
    if (!Number.isFinite(num) || num <= 0 || Math.floor(num) !== num) return null;
    return num;
  };
  return {
    maxHoldDays: limit(raw.maxHoldDays),
    maxHoldsPerYear: limit(raw.maxHoldsPerYear),
    minActiveDays: limit(raw.minActiveDays),
  };
}

export function guardSettingsText(settings) {
  const set = normalizeGuardSettings(settings);
  const parts = [];
  parts.push(set.maxHoldDays === null ? 'no maximum hold length' : `maximum hold length ${set.maxHoldDays} days`);
  parts.push(set.maxHoldsPerYear === null ? 'no yearly hold limit' : `maximum ${set.maxHoldsPerYear} holds per customer per year`);
  parts.push(set.minActiveDays === null ? 'no minimum active period' : `minimum ${set.minActiveDays} active days between holds`);
  return parts.join('; ');
}

// The guardrail check for one proposed hold. history is the
// customer's existing history (holds and move pauses, oldest
// first); proposed carries startDate and expectedReturnDate.
// The result names every limit exceeded, in plain words, and
// says whether the hold may be saved: it may when nothing is
// exceeded, or when the operator has recorded a reason.
export function checkNewHold({ history, startDate, expectedReturnDate, settings, overrideReason } = {}) {
  const start = validGuardDate(startDate);
  const expected = validGuardDate(expectedReturnDate);
  const set = normalizeGuardSettings(settings);
  const reason = text(overrideReason);
  if (!start || !expected || expected <= start) {
    return {
      valid: false,
      allowed: false,
      exceeded: [],
      needsOverrideReason: false,
      message: 'A hold needs a start date and an expected return date after it before the guardrails can be checked.',
    };
  }
  const entries = Array.isArray(history) ? history.slice().sort(byStartThenId) : [];
  const exceeded = [];
  const lengthDays = daysBetween(start, expected);
  if (set.maxHoldDays !== null && lengthDays > set.maxHoldDays) {
    exceeded.push({
      limit: 'maxHoldDays',
      detail: `This hold would last ${lengthDays} days, over the maximum of ${set.maxHoldDays} days.`,
    });
  }
  if (set.maxHoldsPerYear !== null) {
    const year = start.slice(0, 4);
    const inYear = entries.filter((entry) => entry.startDate.slice(0, 4) === year).length;
    if (inYear + 1 > set.maxHoldsPerYear) {
      exceeded.push({
        limit: 'maxHoldsPerYear',
        detail: `This customer already has ${inYear} hold${inYear === 1 ? '' : 's'} in ${year}; this would make ${inYear + 1}, over the maximum of ${set.maxHoldsPerYear} per year.`,
      });
    }
  }
  if (set.minActiveDays !== null) {
    const before = entries.filter((entry) => entry.endDate <= start).sort(byStartThenId);
    const previous = before.length > 0 ? before[before.length - 1] : null;
    if (previous) {
      const gap = daysBetween(previous.endDate, start);
      if (gap < set.minActiveDays) {
        exceeded.push({
          limit: 'minActiveDays',
          detail: `Only ${gap} active day${gap === 1 ? '' : 's'} since the previous hold ended on ${previous.endDate}; the minimum is ${set.minActiveDays} days.`,
        });
      }
    }
    const overlapping = entries.filter((entry) => entry.startDate <= start && entry.endDate > start);
    if (overlapping.length > 0 && !exceeded.some((item) => item.limit === 'minActiveDays')) {
      exceeded.push({
        limit: 'minActiveDays',
        detail: `This hold starts while an earlier hold is still running (it ends ${overlapping[0].endDate}); the minimum active period is ${set.minActiveDays} days after a hold ends.`,
      });
    }
  }
  const needsOverrideReason = exceeded.length > 0;
  const allowed = exceeded.length === 0 || reason !== '';
  return {
    valid: true,
    allowed,
    exceeded,
    needsOverrideReason,
    message: guardCheckText({ valid: true, exceeded, allowed, needsOverrideReason }),
  };
}

export function guardCheckText(check) {
  if (!check || !check.valid) return 'A hold needs a start date and an expected return date after it before the guardrails can be checked.';
  if (check.exceeded.length === 0) return 'Within all guardrails: this hold may be saved.';
  const details = check.exceeded.map((item) => item.detail).join(' ');
  if (check.allowed) return `Over a guardrail, but an override reason is recorded, so this hold may be saved. ${details}`;
  return `Over a guardrail: this hold cannot be saved until an override reason is recorded. ${details}`;
}

// The override log: one record per overridden hold, kept in this
// plan's own store. The reason is recorded here, on the guard's
// side — the hold record itself is never rewritten to carry it.
export function normalizeOverride(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = text(raw.id);
  const customerId = text(raw.customerId);
  const startDate = validGuardDate(raw.startDate);
  const expectedReturnDate = validGuardDate(raw.expectedReturnDate);
  const reason = text(raw.reason);
  const limits = Array.isArray(raw.limits) ? raw.limits.filter((item) => typeof item === 'string' && item) : [];
  if (!id || !customerId || !startDate || !expectedReturnDate || !reason) return null;
  if (expectedReturnDate <= startDate) return null;
  return {
    id,
    customerId,
    customerName: text(raw.customerName),
    startDate,
    expectedReturnDate,
    reason,
    limits,
    recordedDate: validGuardDate(raw.recordedDate) ?? '',
  };
}

export function normalizeOverrideList(list) {
  if (!Array.isArray(list)) return [];
  const byId = new Map();
  for (const row of list) {
    const entry = normalizeOverride(row);
    if (entry) byId.set(entry.id, entry);
  }
  return [...byId.values()].sort(byStartThenId);
}

export function upsertOverride(list, record) {
  const entry = normalizeOverride(record);
  if (!entry) return normalizeOverrideList(list);
  const entries = normalizeOverrideList(list);
  const at = entries.findIndex((row) => row.id === entry.id);
  if (at >= 0) entries[at] = entry;
  else entries.push(entry);
  return entries.sort(byStartThenId);
}

export function removeOverride(list, id) {
  return normalizeOverrideList(list).filter((entry) => entry.id !== text(id));
}

export function holdHistoryHtml(rows) {
  const entries = Array.isArray(rows) ? rows.slice().sort(byStartThenId) : [];
  if (entries.length === 0) return '<p class="empty-state">No holds recorded for this customer.</p>';
  const body = entries
    .map((entry) => {
      const charge = entry.treatment === 'retention' ? formatGuardAmount(entry.retentionCents) : 'No bill';
      const returned = entry.actualEndDate ? ` · returned ${escapeHtml(entry.actualEndDate)}` : '';
      const moveNote = entry.kind === 'move' && entry.oldMohalla && entry.newMohalla
        ? ` · ${escapeHtml(entry.oldMohalla)} → ${escapeHtml(entry.newMohalla)}`
        : '';
      return `<tr><td>${escapeHtml(entry.id)}</td><td>${escapeHtml(GUARD_KIND_LABELS[entry.kind])}</td><td>${escapeHtml(entry.startDate)}</td><td>${escapeHtml(entry.expectedEndDate)}</td><td>${escapeHtml(GUARD_REASON_LABELS[entry.reason])}</td><td>${escapeHtml(GUARD_TREATMENT_LABELS[entry.treatment])} (${escapeHtml(charge)})</td><td>${escapeHtml(entry.status)}${returned}${moveNote}</td></tr>`;
    })
    .join('');
  return `<table><thead><tr><th>Record</th><th>Kind</th><th>Start</th><th>Expected return</th><th>Reason</th><th>Billing treatment</th><th>Status</th></tr></thead><tbody>${body}</tbody></table>`;
}

export function holdHistoryCsv(rows) {
  const entries = Array.isArray(rows) ? rows.slice().sort(byStartThenId) : [];
  const lines = ['Record,Kind,Customer,Start,Expected return,Actual return,Reason,Billing treatment,Retention charge,Status,Old mohalla,New mohalla'];
  for (const entry of entries) {
    lines.push([
      csvCell(entry.id),
      csvCell(GUARD_KIND_LABELS[entry.kind]),
      csvCell(entry.customerName || entry.customerId),
      csvCell(entry.startDate),
      csvCell(entry.expectedEndDate),
      csvCell(entry.actualEndDate),
      csvCell(GUARD_REASON_LABELS[entry.reason]),
      csvCell(GUARD_TREATMENT_LABELS[entry.treatment]),
      csvCell(entry.treatment === 'retention' ? formatGuardAmount(entry.retentionCents) : ''),
      csvCell(entry.status),
      csvCell(entry.oldMohalla),
      csvCell(entry.newMohalla),
    ]);
  }
  return lines.join('\n');
}

export function holdHistoryFilename() {
  return 'hold-history.csv';
}

export function overrideHtml(rows) {
  const entries = normalizeOverrideList(rows);
  if (entries.length === 0) return '<p class="empty-state">No override reasons recorded.</p>';
  const body = entries
    .map((entry) => `<tr><td>${escapeHtml(entry.id)}</td><td>${escapeHtml(entry.customerName || entry.customerId)}</td><td>${escapeHtml(entry.startDate)}</td><td>${escapeHtml(entry.expectedReturnDate)}</td><td>${escapeHtml(entry.limits.join(', '))}</td><td>${escapeHtml(entry.reason)}</td></tr>`)
    .join('');
  return `<table><thead><tr><th>Record</th><th>Customer</th><th>Start</th><th>Expected return</th><th>Limits exceeded</th><th>Override reason</th></tr></thead><tbody>${body}</tbody></table>`;
}
