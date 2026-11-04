// Plan 85 (Plan 1-100) — Move-house pause and transfer (same
// customer, new address).
//
// A customer moving to another house in Shahdara is treated as a
// departure plus a brand-new signup, so their payment history,
// package, and trust record are lost and a second installation is
// charged as if they were a stranger. This module is the move
// record that was missing: one record per move, linked to the
// customer profile, with the old mohalla and address, the new
// mohalla and address, the pause start date, the expected
// reconnect date, and the operator-set hold treatment for the
// gap (Plan 82). The move pauses billing for the gap between
// disconnect and reconnect under that treatment, and it creates
// no new customer, no duplicate bill, and no new deposit.
//
// What already existed, checked first (dedup audit, Plans 82/83
// vs Plan U): the lifecycle timeline (Plan U) is presentation
// only, and the request queue (Plan 50) owns requests, not
// moves. A move arriving as a request keeps only its request id
// here. The connection update itself — a new port, splitter, or
// ONU — is recorded through the connection register (Plan 17);
// only its record id is kept here, and the old connection entry
// stays in that register's history. Deposit outcomes stay with
// the deposit register (Plan 77); no deposit field is kept here.
//
// The fences, stated plainly:
//   - A move record changes no customer, bill, payment, package,
//     or deposit record. This module holds no bill, payment,
//     package, or deposit field, and it never touches a customer
//     record — the moved customer keeps one profile with one
//     payment history, because nothing here creates a second one.
//   - A month fully inside the move gap takes the move's hold
//     treatment: no bill raised, or exactly the operator-set
//     retention charge and nothing else. A month only partly
//     inside the gap is an ordinary month — the module never
//     invents a pro-rata split for it.
//   - Reconnecting at the new address closes the move with a
//     real reconnect date and keeps the full record (both
//     addresses, both dates). A reconnected move can be reopened
//     when the operator recorded the wrong outcome; the
//     reconnect date is cleared with it, so a reopened move
//     carries no stale trail.
//   - Half-formed records are refused outright, never stored
//     half-formed. Dates are strict YYYY-MM-DD calendar dates
//     (2026-02-30 is not a date). Money is integer cents: a
//     *Cents field is already in cents and is used as-is; a
//     plain amount field is rupees and converts at x100 once,
//     so a stored record re-read through the normaliser never
//     inflates a hundredfold. Inputs are never mutated, and the
//     module never reads storage, the clock, or the network.

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;

export const MOVE_STATUSES = ['pending', 'reconnected'];

export const MOVE_STATUS_LABELS = {
  pending: 'Pending',
  reconnected: 'Reconnected',
};

export const MOVE_TREATMENTS = ['no_bill', 'retention'];

export const MOVE_TREATMENT_LABELS = {
  no_bill: 'No bill raised',
  retention: 'Retention charge only',
};

// Plan T canonical aliases, mirrored here so this module stays
// import-free: "Mohalla Bani", "bani" and "BANII" are one mohalla.
const MOHALLA_ALIASES = {
  bani: 'BANII',
  banii: 'BANII',
  kishti: 'KISHTII',
  kishtii: 'KISHTII',
  chamyaa: 'CHAMYAAA',
  chamyaaa: 'CHAMYAAA',
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

export function validMoveDate(value) {
  const raw = text(value);
  if (!raw) return null;
  const datePart = raw.slice(0, 10);
  if (!DATE_RE.test(datePart)) return null;
  const [year, month, day] = datePart.split('-').map(Number);
  const built = new Date(Date.UTC(year, month - 1, day));
  if (built.getUTCFullYear() !== year || built.getUTCMonth() !== month - 1 || built.getUTCDate() !== day) return null;
  return datePart;
}

function pad(value) {
  return String(value).padStart(2, '0');
}

function monthBounds(month) {
  const match = MONTH_RE.exec(text(month));
  if (!match) return null;
  const year = Number(match[1]);
  const monthNumber = Number(match[2]);
  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return [`${year}-${pad(monthNumber)}-01`, `${year}-${pad(monthNumber)}-${pad(lastDay)}`];
}

function toCents(raw) {
  if (raw === null || raw === undefined || raw === '') return null;
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw)) return null;
    return Math.round(raw * 100);
  }
  const cleaned = String(raw).replace(/,/g, '').trim();
  if (!cleaned || !/^-?\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  return Math.round(parseFloat(cleaned) * 100);
}

function centsField(raw) {
  if (raw === null || raw === undefined || raw === '') return null;
  const num = typeof raw === 'number' ? raw : Number(String(raw).replace(/,/g, '').trim());
  if (!Number.isFinite(num) || !Number.isInteger(num)) return null;
  return num;
}

// The retention charge, from either spelling: a *Cents field is
// already in cents and is used as-is; a plain amount field is
// rupees and converts at x100 once.
function retentionChargeCents(raw) {
  const cents = centsField(raw.retentionCents ?? raw.retentionAmountCents);
  if (cents !== null) return cents;
  if (raw.retentionCents !== undefined || raw.retentionAmountCents !== undefined) return null;
  return toCents(raw.retentionAmount ?? raw.retentionCharge ?? raw.retention);
}

export function moveMohallaKey(value) {
  const raw = text(value).toLowerCase().replace(/^mohalla\s+/i, '').trim();
  if (!raw) return '__unassigned__';
  return MOHALLA_ALIASES[raw] ?? text(value).trim().toUpperCase();
}

export function moveMohallaLabel(value) {
  const key = moveMohallaKey(value);
  if (key === '__unassigned__') return 'No mohalla set';
  return text(value).trim();
}

export function normalizeMove(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = text(raw.id);
  const customerId = text(raw.customerId);
  const pauseStartDate = validMoveDate(raw.pauseStartDate);
  const expectedReconnectDate = validMoveDate(raw.expectedReconnectDate);
  const status = text(raw.status);
  const treatment = text(raw.treatment);
  const oldAddress = text(raw.oldAddress);
  const newAddress = text(raw.newAddress);
  if (!id || !customerId) return null;
  if (!pauseStartDate || !expectedReconnectDate) return null;
  // A move must span at least into a later day: the expected
  // reconnect date is after the pause start, never on it or
  // before it.
  if (expectedReconnectDate <= pauseStartDate) return null;
  if (!MOVE_STATUSES.includes(status)) return null;
  if (!MOVE_TREATMENTS.includes(treatment)) return null;
  if (!oldAddress || !newAddress) return null;
  // A retention move without a positive charge is half-formed:
  // the charge is the whole point of the treatment. A no-bill
  // move carries no charge at all, so any supplied amount is
  // dropped rather than kept as a stray figure.
  let retentionCents = null;
  if (treatment === 'retention') {
    retentionCents = retentionChargeCents(raw);
    if (retentionCents === null || retentionCents <= 0) return null;
  }
  // A reconnected move needs a real reconnect date on or after
  // the pause start; a pending move carries no reconnect date.
  let actualReconnectDate = '';
  if (status === 'reconnected') {
    actualReconnectDate = validMoveDate(raw.actualReconnectDate);
    if (!actualReconnectDate || actualReconnectDate < pauseStartDate) return null;
  }
  return {
    id,
    customerId,
    customerName: text(raw.customerName),
    requestId: text(raw.requestId),
    connectionId: text(raw.connectionId),
    oldMohalla: moveMohallaLabel(raw.oldMohalla),
    oldMohallaKey: moveMohallaKey(raw.oldMohalla),
    oldAddress,
    newMohalla: moveMohallaLabel(raw.newMohalla),
    newMohallaKey: moveMohallaKey(raw.newMohalla),
    newAddress,
    pauseStartDate,
    expectedReconnectDate,
    actualReconnectDate,
    treatment,
    retentionCents,
    status,
    note: text(raw.note),
  };
}

export function normalizeMoveList(list) {
  if (!Array.isArray(list)) return [];
  const byId = new Map();
  for (const row of list) {
    const entry = normalizeMove(row);
    if (entry) byId.set(entry.id, entry);
  }
  return [...byId.values()];
}

export function findMove(list, id) {
  const entries = normalizeMoveList(list);
  return entries.find((entry) => entry.id === text(id)) ?? null;
}

export function upsertMove(list, record) {
  const entry = normalizeMove(record);
  if (!entry) return Array.isArray(list) ? normalizeMoveList(list) : [];
  const entries = normalizeMoveList(list);
  const at = entries.findIndex((row) => row.id === entry.id);
  if (at >= 0) entries[at] = entry;
  else entries.push(entry);
  return entries;
}

export function removeMove(list, id) {
  const entries = normalizeMoveList(list);
  return entries.filter((entry) => entry.id !== text(id));
}

// The date a move stops covering: the actual reconnect date
// once reconnected, otherwise the expected reconnect date.
function effectiveEndDate(entry) {
  return entry.status === 'reconnected' ? entry.actualReconnectDate : entry.expectedReconnectDate;
}

// What one month means for one move. Returns null for a move or
// month that is not well-formed. Otherwise:
//   - a month fully inside the gap: the move's own treatment —
//     no_bill with a zero charge, or retention with exactly the
//     operator-set retention charge and nothing else;
//   - any other month: ordinary, with no charge figure from this
//     module (ordinary months are priced by the billing path,
//     never here).
export function moveGapTreatment(move, month) {
  const entry = normalizeMove(move);
  if (!entry) return null;
  const bounds = monthBounds(month);
  if (!bounds) return null;
  const [first, last] = bounds;
  const end = effectiveEndDate(entry);
  const fullyInside = entry.pauseStartDate <= first && last <= end;
  if (!fullyInside) return { month: text(month), treatment: 'ordinary', chargeCents: null, fullyInside: false };
  if (entry.treatment === 'retention') {
    return { month: text(month), treatment: 'retention', chargeCents: entry.retentionCents, fullyInside: true };
  }
  return { month: text(month), treatment: 'no_bill', chargeCents: 0, fullyInside: true };
}

export function moveGapTreatmentText(result) {
  if (!result) return 'No treatment: the move or the month is not well-formed.';
  if (!result.fullyInside) return `${result.month}: ordinary billing — the month is not fully inside the move gap.`;
  if (result.treatment === 'retention') {
    return `${result.month}: retention charge only — Rs. ${(result.chargeCents / 100).toFixed(2)}, and nothing else.`;
  }
  return `${result.month}: no bill raised for this month.`;
}

// Only a pending move can be reconnected, and only with a real
// reconnect date on or after the pause start. Reconnecting
// closes the move and keeps the full record; it never creates a
// new customer, a bill, or a deposit.
export function reconnectMove(list, id, actualReconnectDate) {
  const entries = normalizeMoveList(list);
  const at = entries.findIndex((entry) => entry.id === text(id));
  if (at < 0) return entries;
  const current = entries[at];
  if (current.status !== 'pending') return entries;
  const moved = normalizeMove({ ...current, status: 'reconnected', actualReconnectDate: actualReconnectDate ?? '' });
  if (!moved) return entries;
  entries[at] = moved;
  return entries;
}

// A reconnected move can be reopened when the operator recorded
// the wrong outcome; the reconnect date is cleared with it, so
// a reopened move carries no stale trail.
export function reopenMove(list, id) {
  const entries = normalizeMoveList(list);
  const at = entries.findIndex((entry) => entry.id === text(id));
  if (at < 0) return entries;
  const current = entries[at];
  if (current.status !== 'pending') {
    const moved = normalizeMove({ ...current, status: 'pending', actualReconnectDate: '' });
    if (!moved) return entries;
    entries[at] = moved;
  }
  return entries;
}

function byPauseThenId(a, b) {
  if (a.pauseStartDate !== b.pauseStartDate) return a.pauseStartDate < b.pauseStartDate ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export function movesFiltered(list, filters = {}) {
  const entries = normalizeMoveList(list);
  const status = text(filters.status);
  const treatment = text(filters.treatment);
  const mohalla = moveMohallaKey(filters.mohalla);
  return entries
    .filter((entry) => {
      if (status && entry.status !== status) return false;
      if (treatment && entry.treatment !== treatment) return false;
      // A move belongs to both mohallas: the filter matches
      // either the old or the new one.
      if (filters.mohalla && entry.oldMohallaKey !== mohalla && entry.newMohallaKey !== mohalla) return false;
      return true;
    })
    .sort(byPauseThenId);
}

export function pendingMoves(list) {
  return normalizeMoveList(list)
    .filter((entry) => entry.status === 'pending')
    .sort(byPauseThenId);
}

export function buildMoveSummary(list) {
  const entries = normalizeMoveList(list);
  const summary = { total: entries.length, pending: 0, reconnected: 0, gapMonthsNoBill: 0, retentionCents: 0 };
  for (const entry of entries) {
    if (entry.status === 'pending') summary.pending += 1;
    if (entry.status === 'reconnected') summary.reconnected += 1;
  }
  return summary;
}

export function moveSummaryText(summary) {
  if (!summary) return 'No moves recorded yet.';
  return `${summary.total} move${summary.total === 1 ? '' : 's'} recorded: ${summary.pending} pending, ${summary.reconnected} reconnected.`;
}

// The Plan 84 resume-queue input shape for one pending move:
// a move already reconnected never queues; one without a usable
// reconnect date is dropped, never guessed. The new mohalla is
// the one the returning household lives in.
export function toResumeRelocation(move) {
  const entry = normalizeMove(move);
  if (!entry) return null;
  if (entry.status !== 'pending') return null;
  if (!entry.expectedReconnectDate) return null;
  return {
    id: entry.id,
    customerId: entry.customerId,
    customerName: entry.customerName,
    returnDate: entry.expectedReconnectDate,
    expectedReturnDate: entry.expectedReconnectDate,
    status: 'pending',
    mohalla: entry.newMohalla,
  };
}

export function movesToResumeRelocations(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const row of list) {
    const entry = toResumeRelocation(row);
    if (entry) out.push(entry);
  }
  return out;
}

export function moveHtml(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return '<p class="muted">No moves in view.</p>';
  const body = rows.map((row) => `<tr><td>${escapeHtml(row.id)}</td><td>${escapeHtml(row.customerName || row.customerId)}</td><td>${escapeHtml(row.oldMohalla)} — ${escapeHtml(row.oldAddress)}</td><td>${escapeHtml(row.newMohalla)} — ${escapeHtml(row.newAddress)}</td><td>${escapeHtml(row.pauseStartDate)}</td><td>${escapeHtml(row.expectedReconnectDate)}</td><td>${escapeHtml(row.actualReconnectDate || '—')}</td><td>${escapeHtml(MOVE_TREATMENT_LABELS[row.treatment] ?? row.treatment)}</td><td>${escapeHtml(MOVE_STATUS_LABELS[row.status] ?? row.status)}</td></tr>`).join('');
  return `<table class="data-table"><thead><tr><th>Move id</th><th>Customer</th><th>Old address</th><th>New address</th><th>Pause start</th><th>Expected reconnect</th><th>Reconnected</th><th>Gap treatment</th><th>Status</th></tr></thead><tbody>${body}</tbody></table>`;
}

export function moveCsv(rows) {
  const header = 'move_id,customer,old_mohalla,old_address,new_mohalla,new_address,pause_start,expected_reconnect,actual_reconnect,treatment,status';
  const lines = (Array.isArray(rows) ? rows : []).map((row) => [
    row.id, row.customerName || row.customerId, row.oldMohalla, row.oldAddress,
    row.newMohalla, row.newAddress, row.pauseStartDate, row.expectedReconnectDate,
    row.actualReconnectDate || '', row.treatment, row.status,
  ].map(csvCell).join(','));
  return [header, ...lines].join('\n');
}

export function moveFilename() {
  return 'move-transfers.csv';
}
