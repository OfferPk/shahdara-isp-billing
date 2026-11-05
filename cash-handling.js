// Plan 207 (Plan 203-350) — Cash handling safety record (two-person
// count and safe/till note).
//
// Cash counted alone and kept in an unrecorded till or safe leaves no
// witness when a count is later questioned. The denomination count
// (Plan 4) covers what notes and coins were counted, the cash-in-hand
// limit (Plan 90) covers how much a collector may carry, and the
// collector settlement statement (Plan 129) covers the day's
// settlement — but none of them records WHO counted the cash, WHO
// witnessed it, and WHERE it was kept. This module is that missing
// piece, and only that piece.
//
// Scope fence, stated plainly:
//   - One record per count: date, amount, counted by, witnessed by,
//     safe or till location. It records the count and custody only.
//   - It counts no denominations itself and it moves no money: it
//     never reads or writes any denomination count, payment, handover,
//     cash-in-hand, or settlement record. The caller supplies every
//     figure; this module only validates, flags, and compares.
//   - A count with only one person is FLAGGED, not refused: a
//     single-person count is still recorded, but it stays visible in
//     the flagged list until a witness is named. Refusing it would
//     hide the very gap the record exists to expose. (There is no
//     edit function at all — a record is recorded or removed — so a
//     flagged count can only be corrected by removing it and
//     recording it again with its witness.)
//   - The day-sheet comparison reports a match or a mismatch; it
//     never rewrites either figure. A record's amount is compared
//     against the day sheet figure the caller supplies for that date,
//     and the difference is shown signed.
//   - It is import-free: it never reads storage, the clock, or the
//     network, and never mutates an input. Dates are real YYYY-MM-DD
//     calendar dates checked against a days-in-month table, so no
//     clock object is needed at all.

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function text(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function validCashHandlingDate(value) {
  const match = DATE_RE.exec(text(value));
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1) return false;
  let limit = DAYS_IN_MONTH[month - 1];
  if (month === 2 && isLeapYear(year)) limit = 29;
  return day <= limit;
}

function escapeHtml(value) {
  return text(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function csvCell(value) {
  const s = text(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function formatCashHandlingAmount(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return `Rs. ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function amountOf(raw) {
  if (Number.isFinite(raw)) return Math.round(raw * 100) / 100;
  if (typeof raw === 'string' && raw.trim() !== '' && Number.isFinite(Number(raw))) {
    return Math.round(Number(raw) * 100) / 100;
  }
  return null;
}

// Normalises one cash-handling record. Returns null for records that
// must never be stored: no id, no counter, no real date, or no usable
// amount (negative or non-numeric). A missing witness or a missing
// location does NOT refuse the record — it is stored and flagged, so
// the gap stays visible instead of being hidden by a refusal.
// Unknown fields are dropped; the caller's object is never mutated.
export function normalizeCashHandlingRecord(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = text(raw.id);
  const countedBy = text(raw.countedBy || raw.counter || '');
  const date = text(raw.date);
  const amount = amountOf(raw.amount);
  if (id === '' || countedBy === '' || !validCashHandlingDate(date)) return null;
  if (amount === null || amount < 0) return null;
  return {
    id,
    date,
    amount,
    countedBy,
    witnessedBy: text(raw.witnessedBy || raw.witness || ''),
    location: text(raw.location || raw.safeOrTill || ''),
    note: text(raw.note || ''),
  };
}

export function normalizeCashHandlingList(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of list) {
    const record = normalizeCashHandlingRecord(raw);
    if (!record || seen.has(record.id)) continue;
    seen.add(record.id);
    out.push(record);
  }
  return out;
}

export function findCashHandlingRecord(list, id) {
  const wanted = text(id);
  if (wanted === '') return null;
  return normalizeCashHandlingList(list).find((record) => record.id === wanted) || null;
}

// Records a count, returning a NEW list. A duplicate id is never
// rewritten: the existing record stays and the list is returned
// unchanged, so a count cannot be silently replaced by a second
// record carrying the same id.
export function recordCashHandling(list, raw) {
  const clean = normalizeCashHandlingList(list);
  const record = normalizeCashHandlingRecord(raw);
  if (!record) return clean;
  if (clean.some((existing) => existing.id === record.id)) return clean;
  return [...clean, record];
}

export function removeCashHandling(list, id) {
  const wanted = text(id);
  if (wanted === '') return normalizeCashHandlingList(list);
  return normalizeCashHandlingList(list).filter((record) => record.id !== wanted);
}

export function cashHandlingSorted(list) {
  return normalizeCashHandlingList(list).slice().sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    if (a.countedBy !== b.countedBy) return a.countedBy < b.countedBy ? -1 : 1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

export function cashHandlingForDate(list, date) {
  const wanted = text(date);
  if (wanted === '') return [];
  return cashHandlingSorted(list).filter((record) => record.date === wanted);
}

export function cashHandlingForCounter(list, counter) {
  const wanted = text(counter).toLowerCase();
  if (wanted === '') return cashHandlingSorted(list);
  return cashHandlingSorted(list).filter((record) => record.countedBy.toLowerCase().includes(wanted));
}

export function cashHandlingForLocation(list, location) {
  const wanted = text(location).toLowerCase();
  if (wanted === '') return cashHandlingSorted(list);
  return cashHandlingSorted(list).filter((record) => record.location.toLowerCase().includes(wanted));
}

// Flags for one record, in plain words. A count is single-person
// when no witness is named, or when the witness is the same person
// as the counter (a witness who is the counter is no witness at
// all). A record with no location is flagged separately, so the shop
// can always say where the cash was kept.
export function cashHandlingFlags(record) {
  const clean = normalizeCashHandlingRecord(record);
  if (!clean) return [];
  const flags = [];
  if (clean.witnessedBy === '' || clean.witnessedBy.toLowerCase() === clean.countedBy.toLowerCase()) {
    flags.push('single-person');
  }
  if (clean.location === '') flags.push('no-location');
  return flags;
}

export function cashHandlingIsFlagged(record) {
  return cashHandlingFlags(record).length > 0;
}

export function cashHandlingIsSinglePerson(record) {
  return cashHandlingFlags(record).includes('single-person');
}

export function cashHandlingFlagged(list) {
  return cashHandlingSorted(list).filter((record) => cashHandlingIsFlagged(record));
}

export function cashHandlingSinglePerson(list) {
  return cashHandlingSorted(list).filter((record) => cashHandlingIsSinglePerson(record));
}

// Compares one record's amount against the day sheet figure the
// caller supplies for that date. The comparison only reports: a
// mismatch is shown with its signed difference, never resolved by
// rewriting either figure. A missing day sheet figure leaves the
// record unchecked, not matched — an unchecked count must never
// look like a verified one.
export function compareCashHandlingToDaySheet(record, daySheetAmount) {
  const clean = normalizeCashHandlingRecord(record);
  if (!clean) return null;
  const daySheet = amountOf(daySheetAmount);
  if (daySheet === null) {
    return {
      id: clean.id,
      date: clean.date,
      recordAmount: clean.amount,
      daySheetAmount: null,
      difference: null,
      status: 'unchecked',
      statusLabel: 'Unchecked',
    };
  }
  const difference = Math.round((clean.amount - daySheet) * 100) / 100;
  const matched = difference === 0;
  return {
    id: clean.id,
    date: clean.date,
    recordAmount: clean.amount,
    daySheetAmount: daySheet,
    difference,
    status: matched ? 'matched' : 'mismatch',
    statusLabel: matched ? 'Matched' : 'Mismatch',
  };
}

export function cashHandlingDaySheetText(record, daySheetAmount) {
  const comparison = compareCashHandlingToDaySheet(record, daySheetAmount);
  if (!comparison) return 'No cash-handling record to compare.';
  if (comparison.status === 'unchecked') {
    return `${comparison.id} (${comparison.date}): ${formatCashHandlingAmount(comparison.recordAmount)} — no day sheet figure supplied, unchecked.`;
  }
  const sign = comparison.difference > 0 ? '+' : '';
  return `${comparison.id} (${comparison.date}): record ${formatCashHandlingAmount(comparison.recordAmount)} vs day sheet ${formatCashHandlingAmount(comparison.daySheetAmount)} — difference ${sign}${formatCashHandlingAmount(comparison.difference)} [${comparison.statusLabel.toUpperCase()}]`;
}

export function cashHandlingRecordText(record) {
  const clean = normalizeCashHandlingRecord(record);
  if (!clean) return 'No cash-handling record.';
  const witness = clean.witnessedBy === '' ? 'No witness named' : clean.witnessedBy;
  const location = clean.location === '' ? 'No location noted' : clean.location;
  const flags = cashHandlingFlags(clean);
  const flagText = flags.length > 0 ? ` — flagged: ${flags.join(', ')}` : '';
  const noteText = clean.note === '' ? '' : ` — ${clean.note}`;
  return `${clean.id} · ${clean.date} · ${formatCashHandlingAmount(clean.amount)} · counted by ${clean.countedBy} · witnessed by ${witness} · kept at ${location}${flagText}${noteText}`;
}

export function cashHandlingSummaryText(list) {
  const clean = cashHandlingSorted(list);
  if (clean.length === 0) return 'No cash-handling counts recorded.';
  const flagged = clean.filter((record) => cashHandlingIsFlagged(record)).length;
  const singlePerson = clean.filter((record) => cashHandlingIsSinglePerson(record)).length;
  const total = clean.reduce((sum, record) => sum + record.amount, 0);
  const flaggedText = flagged === 0
    ? 'none flagged'
    : `${flagged} flagged (${singlePerson} single-person)`;
  return `${clean.length} count${clean.length === 1 ? '' : 's'} recorded, ${formatCashHandlingAmount(total)} in total — ${flaggedText}.`;
}

export function cashHandlingRecordHtml(record) {
  const clean = normalizeCashHandlingRecord(record);
  if (!clean) return '';
  return `<div class="cash-handling-record"><span>${escapeHtml(cashHandlingRecordText(clean))}</span></div>`;
}

export function cashHandlingAllHtml(list) {
  const clean = cashHandlingSorted(list);
  if (clean.length === 0) return '<p class="empty-state">No cash-handling counts recorded.</p>';
  return clean.map((record) => cashHandlingRecordHtml(record)).join('');
}

export function cashHandlingCsv(list) {
  const clean = cashHandlingSorted(list);
  const lines = ['id,date,amount,counted_by,witnessed_by,location,note,flags'];
  for (const record of clean) {
    lines.push([
      record.id,
      record.date,
      record.amount.toFixed(2),
      record.countedBy,
      record.witnessedBy,
      record.location,
      record.note,
      cashHandlingFlags(record).join(';'),
    ].map(csvCell).join(','));
  }
  return lines.join('\n');
}

export function cashHandlingFilename() {
  return 'cash-handling.csv';
}
