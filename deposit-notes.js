// Plan 114 (Plan 101-202) — Security deposit interest and adjustment notes.
//
// A security deposit can sit for years with no record of interest,
// adjustment, or partial return, so the amount owed back at exit
// becomes a guess. This module is that short, checkable history:
// one note per deposit per period, naming its basis in plain words,
// its amount, and its date, linked to the deposit record by deposit
// id only.
//
// What already existed, checked first:
//   - The deposit record itself (Plan 77) holds the deposit: device,
//     serial, amount held, date taken, status. This module never
//     opens that record and never changes it; it only carries the
//     deposit id, so the notes and the deposit agree without either
//     one rewriting the other.
//   - A note here creates no payment and settles nothing by itself.
//     When a customer leaves, the operator settles the deposit
//     through the existing path, reading this history as evidence.
//
// The fences, stated plainly:
//   - A note is refused outright when it is half-formed: no id, no
//     deposit id, no customer, no kind, a blank basis, an impossible
//     date, a bad period, or no usable amount. Unknown fields are
//     dropped, so a note can never grow a payment, bill, or price
//     field.
//   - A note is never edited. The only later change is a dated
//     follow-up note that supersedes it: the original stays in the
//     history, marked superseded, and only active notes count
//     toward the stated balance. A follow-up dated before the note
//     it supersedes is refused, and so is a follow-up for a
//     different deposit.
//   - One active note per deposit per period per kind: a second
//     active note for the same deposit, period, and kind is refused.
//     A note with no period recorded is not covered by that rule.
//     Superseding first frees the slot, so a follow-up for the same
//     period and kind is always possible.
//   - Money is integer cents with a plain sign rule: a positive
//     amount adds to the amount owed back, a negative amount
//     reduces it (a partial return, or a downward adjustment). A
//     `*Cents` integer is used as-is; a plain amount is rupees and
//     converts exactly once (x100), so a stored record re-read
//     through the normaliser never inflates a hundredfold. A zero
//     amount is refused: a note that changes nothing is not a note.
//   - Dates are strict YYYY-MM-DD calendar dates (2026-02-30 is not
//     a date) and periods are strict YYYY-MM months. The module
//     never reads storage, the DOM, the clock, or the network, and
//     it imports nothing.

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const PERIOD_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;

export const DEPOSIT_NOTE_KINDS = ['interest', 'adjustment', 'partial_return'];

export function validDepositNoteDate(value) {
  if (typeof value !== 'string') return false;
  const match = DATE_RE.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function validDepositNotePeriod(value) {
  return typeof value === 'string' && PERIOD_RE.test(value);
}

function cleanText(value) {
  if (value === null || value === undefined) return '';
  return String(value).normalize('NFKC').trim();
}

/**
 * One amount to integer cents, without ever guessing the unit: an
 * `*Cents` integer is used as-is, while a plain amount is always
 * rupees and converts exactly once (x100). Anything else is null.
 */
export function depositNoteAmountCents(record, centsKey, plainKey) {
  if (!record || typeof record !== 'object') return null;
  if (Number.isInteger(record[centsKey])) return record[centsKey];
  const plain = record[plainKey];
  if (typeof plain === 'number' && Number.isFinite(plain)) return Math.round(plain * 100);
  if (typeof plain === 'string' && plain.trim() !== '') {
    const parsed = Number(plain.trim());
    if (Number.isFinite(parsed)) return Math.round(parsed * 100);
  }
  return null;
}

export function depositNoteKindLabel(kind) {
  if (kind === 'interest') return 'Interest';
  if (kind === 'adjustment') return 'Adjustment';
  if (kind === 'partial_return') return 'Partial return';
  return 'Note';
}

export function normalizeDepositNote(record) {
  if (!record || typeof record !== 'object') return null;
  const id = cleanText(record.id);
  const depositId = cleanText(record.depositId);
  const customerId = cleanText(record.customerId);
  const kind = cleanText(record.kind);
  const basis = cleanText(record.basis);
  if (!id || !depositId || !customerId || !kind || !basis) return null;
  if (!DEPOSIT_NOTE_KINDS.includes(kind)) return null;
  const noteDate = cleanText(record.noteDate);
  if (!validDepositNoteDate(noteDate)) return null;
  const period = cleanText(record.period);
  if (period !== '' && !validDepositNotePeriod(period)) return null;
  const amountCents = depositNoteAmountCents(record, 'amountCents', 'amount');
  if (amountCents === null || amountCents === 0) return null;
  return {
    id,
    depositId,
    customerId,
    customerName: cleanText(record.customerName),
    kind,
    period,
    basis,
    amountCents,
    noteDate,
    supersededBy: cleanText(record.supersededBy),
    supersededDate: cleanText(record.supersededDate),
  };
}

export function normalizeDepositNoteList(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const item of list) {
    const normalized = normalizeDepositNote(item);
    if (normalized) out.push(normalized);
  }
  return out;
}

export function findDepositNote(list, id) {
  const clean = cleanText(id);
  if (!clean) return null;
  return normalizeDepositNoteList(list).find((n) => n.id === clean) ?? null;
}

export function isDepositNoteActive(note) {
  return normalizeDepositNote(note) !== null && cleanText(note.supersededBy) === '';
}

export function activeDepositNotes(list) {
  return normalizeDepositNoteList(list).filter((n) => n.supersededBy === '');
}

export function supersededDepositNotes(list) {
  return normalizeDepositNoteList(list).filter((n) => n.supersededBy !== '');
}

export function notesForDeposit(list, depositId) {
  const clean = cleanText(depositId);
  if (!clean) return [];
  return normalizeDepositNoteList(list).filter((n) => n.depositId === clean);
}

export function notesForCustomer(list, customerId) {
  const clean = cleanText(customerId);
  if (!clean) return [];
  return normalizeDepositNoteList(list).filter((n) => n.customerId === clean);
}

function hasActivePeriodKindClash(notes, candidate) {
  if (candidate.period === '') return false;
  return notes.some((n) => n.supersededBy === '' && n.depositId === candidate.depositId
    && n.period === candidate.period && n.kind === candidate.kind && n.id !== candidate.id);
}

export function upsertDepositNote(list, record) {
  const current = normalizeDepositNoteList(list);
  const normalized = normalizeDepositNote(record);
  if (!normalized) return current;
  const existing = current.find((n) => n.id === normalized.id);
  if (existing) {
    // An id already recorded is never rewritten: an identical
    // re-save leaves the list unchanged, and a different figure
    // under the same id is refused, never silently applied.
    return current;
  }
  if (normalized.supersededBy !== '' || normalized.supersededDate !== '') return current;
  if (hasActivePeriodKindClash(current, normalized)) return current;
  return [...current, normalized];
}

export function supersedeDepositNote(list, id, followUp) {
  const current = normalizeDepositNoteList(list);
  const clean = cleanText(id);
  const original = current.find((n) => n.id === clean);
  if (!original || original.supersededBy !== '') return current;
  const next = normalizeDepositNote(followUp);
  if (!next) return current;
  if (next.supersededBy !== '' || next.supersededDate !== '') return current;
  if (current.some((n) => n.id === next.id)) return current;
  if (next.depositId !== original.depositId) return current;
  // A follow-up is dated: it cannot predate the note it replaces.
  if (next.noteDate < original.noteDate) return current;
  const marked = current.map((n) => (n.id === clean
    ? { ...n, supersededBy: next.id, supersededDate: next.noteDate }
    : n));
  if (hasActivePeriodKindClash(marked, next)) return current;
  return [...marked, next];
}

/**
 * The stated balance for one deposit: the opening amount held plus
 * the active notes only. Superseded notes stay in the history but
 * never count twice. Returns null when the opening figure is
 * unusable, never a zero-filled balance.
 */
export function depositBalance(list, depositId, openingCents) {
  if (!Number.isInteger(openingCents)) return null;
  const clean = cleanText(depositId);
  if (!clean) return null;
  const notes = notesForDeposit(list, clean);
  const active = notes.filter((n) => n.supersededBy === '');
  const notesCents = active.reduce((sum, n) => sum + n.amountCents, 0);
  return {
    depositId: clean,
    openingCents,
    notesCents,
    balanceCents: openingCents + notesCents,
    activeCount: active.length,
    supersededCount: notes.length - active.length,
  };
}

function formatRs(cents) {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  return `${sign}Rs. ${(abs / 100).toFixed(2)}`;
}

export function depositNoteSummaryText(list) {
  const notes = normalizeDepositNoteList(list);
  if (notes.length === 0) return 'No deposit notes recorded yet.';
  const active = notes.filter((n) => n.supersededBy === '');
  const superseded = notes.length - active.length;
  const activeCents = active.reduce((sum, n) => sum + n.amountCents, 0);
  return `${notes.length} deposit note${notes.length === 1 ? '' : 's'} (${active.length} active, ${superseded} superseded); active notes total ${formatRs(activeCents)}.`;
}

export function depositBalanceText(balance) {
  if (!balance) return 'Balance not stated: the opening amount held is unusable.';
  return `Opening ${formatRs(balance.openingCents)} + active notes ${formatRs(balance.notesCents)} = balance ${formatRs(balance.balanceCents)} (${balance.activeCount} active, ${balance.supersededCount} superseded).`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function depositNoteHtml(note) {
  const normalized = normalizeDepositNote(note);
  if (!normalized) return '<p>Deposit note not recorded: its inputs are incomplete.</p>';
  const who = normalized.customerName || normalized.customerId;
  const periodPart = normalized.period ? ` · period ${escapeHtml(normalized.period)}` : '';
  const supersededPart = normalized.supersededBy
    ? ` · superseded by ${escapeHtml(normalized.supersededBy)} on ${escapeHtml(normalized.supersededDate)} (kept in history, not counted)`
    : '';
  return `<div>${escapeHtml(who)} · deposit ${escapeHtml(normalized.depositId)} · ${escapeHtml(depositNoteKindLabel(normalized.kind))}${periodPart} · ${escapeHtml(normalized.basis)} · ${escapeHtml(formatRs(normalized.amountCents))} · ${escapeHtml(normalized.noteDate)}${supersededPart}</div>`;
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function depositNoteCsv(list) {
  const notes = normalizeDepositNoteList(list);
  const header = 'id,deposit id,customer,kind,period,basis,amount (Rs),date,superseded by,superseded date';
  const rows = notes.map((n) => [
    n.id,
    n.depositId,
    n.customerName || n.customerId,
    depositNoteKindLabel(n.kind),
    n.period,
    n.basis,
    (n.amountCents / 100).toFixed(2),
    n.noteDate,
    n.supersededBy,
    n.supersededDate,
  ].map(csvCell).join(','));
  return [header, ...rows].join('\n');
}

export function depositNoteFilename() {
  return 'deposit-notes.csv';
}
