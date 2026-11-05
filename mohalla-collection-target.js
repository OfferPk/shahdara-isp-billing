// Plan 225 (Plan 203-350) — Monthly collection target versus actual per mohalla.
//
// Collection targets are set for the whole business or for a field
// day (Plan 3), so a mohalla that misses badly hides inside a
// business total that looks acceptable. The dashboard target suite
// is also business-wide per month. Neither one reports per mohalla
// per month, so this module adds only that missing piece.
//
// One target record per mohalla per month: the mohalla, the target
// amount, the actual collected, and the difference (actual minus
// target). It compares only: it sets no penalty, it changes no bill,
// no payment, and no customer record, and it never reads the ledger
// itself. The caller supplies ledger collections for the month on the
// same fixture, and the check function reports every mismatch plainly
// instead of silently fixing a figure that disagrees.
//
// The fences, stated plainly:
//   - The Plan 3 day-target module, the dashboard collection-target
//     suite, and any ledger or billing module are neither read nor
//     rewritten here. Mohalla names, months, and amounts arrive as
//     caller-supplied values only.
//   - One record per mohalla per month: a second record for the same
//     mohalla and month is refused, never used to overwrite the first.
//   - A mohalla with no target for a month says so plainly, never
//     through an invented zero target.
//   - Inputs are never mutated, and the module never reads storage,
//     the clock, the network, or the page.

const MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function validTargetMonth(value) {
  return typeof value === 'string' && MONTH_RE.test(value);
}

function amountToCents(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'object') return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

function centsField(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'object') return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) return null;
  return n;
}

// A raw record is usable only when it names its mohalla and month
// and carries a target amount. Unknown fields are dropped, never kept.
// Amounts are integer cents: a *Cents field passes through as-is, a
// plain amount converts rupees once, so a re-read never inflates a
// hundredfold.
function normalizeMohallaCollectionTarget(value) {
  if (!value || typeof value !== 'object') return null;
  const id = text(value.id);
  const mohalla = text(value.mohalla);
  const month = text(value.month);
  if (!id || !mohalla || !validTargetMonth(month)) return null;
  let targetCents = null;
  if (value.targetCents != null && value.targetCents !== '') {
    targetCents = centsField(value.targetCents);
  } else {
    targetCents = amountToCents(value.target);
  }
  if (targetCents === null) return null;
  let actualCents = 0;
  if (value.actualCents != null && value.actualCents !== '') {
    const parsed = centsField(value.actualCents);
    if (parsed === null) return null;
    actualCents = parsed;
  } else if (value.actual != null && value.actual !== '') {
    const parsed = amountToCents(value.actual);
    if (parsed === null) return null;
    actualCents = parsed;
  }
  return { id, mohalla, month, targetCents, actualCents };
}

export function normalizeMohallaCollectionTargetList(value) {
  if (!Array.isArray(value)) return [];
  const seenIds = new Set();
  const seenMohallaMonth = new Set();
  const out = [];
  for (const item of value) {
    const row = normalizeMohallaCollectionTarget(item);
    if (!row) continue;
    if (seenIds.has(row.id)) continue;
    const key = `${row.mohalla.toLowerCase()}|${row.month}`;
    if (seenMohallaMonth.has(key)) continue;
    seenIds.add(row.id);
    seenMohallaMonth.add(key);
    out.push(row);
  }
  return out;
}

function compareText(a, b) {
  const lowerA = a.toLowerCase();
  const lowerB = b.toLowerCase();
  if (lowerA < lowerB) return -1;
  if (lowerA > lowerB) return 1;
  return 0;
}

// Targets sorted by mohalla A-Z, then month, then id.
export function mohallaCollectionTargetsSorted(list) {
  const rows = normalizeMohallaCollectionTargetList(list);
  rows.sort((a, b) => compareText(a.mohalla, b.mohalla)
    || (a.month < b.month ? -1 : a.month > b.month ? 1 : 0)
    || compareText(a.id, b.id));
  return rows;
}

export function findMohallaCollectionTarget(list, id) {
  const wanted = text(id);
  if (!wanted) return null;
  return normalizeMohallaCollectionTargetList(list).find((row) => row.id === wanted) || null;
}

export function recordMohallaCollectionTarget(list, value) {
  const row = normalizeMohallaCollectionTarget(value);
  if (!row) return null;
  const rows = normalizeMohallaCollectionTargetList(list);
  if (rows.some((item) => item.id === row.id)) return null;
  if (rows.some((item) => item.mohalla.toLowerCase() === row.mohalla.toLowerCase() && item.month === row.month)) return null;
  return [...rows, row];
}

export function removeMohallaCollectionTarget(list, id) {
  const wanted = text(id);
  if (!wanted) return normalizeMohallaCollectionTargetList(list);
  return normalizeMohallaCollectionTargetList(list).filter((row) => row.id !== wanted);
}

export function targetsForMonth(list, month) {
  const wanted = text(month);
  if (!validTargetMonth(wanted)) return [];
  return mohallaCollectionTargetsSorted(list).filter((row) => row.month === wanted);
}

export function targetsForMohalla(list, mohalla) {
  const wanted = text(mohalla).toLowerCase();
  if (!wanted) return mohallaCollectionTargetsSorted(list);
  return mohallaCollectionTargetsSorted(list).filter((row) => row.mohalla.toLowerCase().includes(wanted));
}

export function targetDifferenceCents(target) {
  const row = normalizeMohallaCollectionTarget(target);
  if (!row) return null;
  return row.actualCents - row.targetCents;
}

export function targetStatus(target) {
  const row = normalizeMohallaCollectionTarget(target);
  if (!row) return 'unknown';
  return row.actualCents >= row.targetCents ? 'hit' : 'missed';
}

export function businessTargetCents(list, month) {
  return targetsForMonth(list, month).reduce((sum, row) => sum + row.targetCents, 0);
}

export function businessActualCents(list, month) {
  return targetsForMonth(list, month).reduce((sum, row) => sum + row.actualCents, 0);
}

export function businessDifferenceCents(list, month) {
  return businessActualCents(list, month) - businessTargetCents(list, month);
}

// Mohallas with no target for the month, stated plainly. A mohalla
// with no target never gets an invented zero target.
export function missingTargetMohallas(knownMohallas, list, month) {
  const wanted = text(month);
  if (!validTargetMonth(wanted)) return [];
  if (!Array.isArray(knownMohallas)) return [];
  const covered = new Set(targetsForMonth(list, wanted).map((row) => row.mohalla.toLowerCase()));
  const out = [];
  for (const name of knownMohallas) {
    const mohalla = text(name);
    if (!mohalla) continue;
    if (!covered.has(mohalla.toLowerCase())) out.push(mohalla);
  }
  return out;
}

export function missingTargetText(knownMohallas, list, month) {
  const missing = missingTargetMohallas(knownMohallas, list, month);
  if (!missing.length) return 'Every listed mohalla has a target for this month.';
  return missing.map((mohalla) => `No target set for ${mohalla}.`).join(' ');
}

// Ledger collections arrive as caller-supplied values only:
// [{ mohalla, month, amountCents }]. Each mohalla's actual must match
// its ledger collections for that month on the same fixture; every
// mismatch is reported plainly, never silently fixed.
export function checkActualAgainstLedger(list, ledger, month) {
  const wanted = text(month);
  if (!validTargetMonth(wanted)) return { matched: [], mismatched: [] };
  const ledgerByMohalla = new Map();
  if (Array.isArray(ledger)) {
    for (const entry of ledger) {
      if (!entry || typeof entry !== 'object') continue;
      if (text(entry.month) !== wanted) continue;
      const mohalla = text(entry.mohalla);
      if (!mohalla) continue;
      const cents = centsField(entry.amountCents);
      if (cents === null) continue;
      const key = mohalla.toLowerCase();
      ledgerByMohalla.set(key, (ledgerByMohalla.get(key) || 0) + cents);
    }
  }
  const matched = [];
  const mismatched = [];
  for (const row of targetsForMonth(list, wanted)) {
    const ledgerActual = ledgerByMohalla.get(row.mohalla.toLowerCase()) || 0;
    const entry = { mohalla: row.mohalla, month: wanted, targetActualCents: row.actualCents, ledgerActualCents: ledgerActual };
    if (row.actualCents === ledgerActual) matched.push(entry);
    else mismatched.push({ ...entry, differenceCents: row.actualCents - ledgerActual });
  }
  return { matched, mismatched };
}

function formatAmount(cents) {
  return `Rs. ${Math.round(cents / 100).toLocaleString('en-US')}`;
}

function escapeHtml(value) {
  return text(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function mohallaCollectionTargetText(target) {
  const row = normalizeMohallaCollectionTarget(target);
  if (!row) return '';
  const difference = row.actualCents - row.targetCents;
  const sign = difference >= 0 ? '+' : '-';
  return `${row.mohalla} — ${row.month}: target ${formatAmount(row.targetCents)}, actual ${formatAmount(row.actualCents)}, difference ${sign}${formatAmount(Math.abs(difference))} (${targetStatus(row) === 'hit' ? 'target hit' : 'target missed'}).`;
}

export function mohallaCollectionTargetHtml(target) {
  const row = normalizeMohallaCollectionTarget(target);
  if (!row) return '';
  return `<p>${escapeHtml(mohallaCollectionTargetText(row))}</p>`;
}

export function mohallaCollectionTargetAllHtml(list) {
  const rows = mohallaCollectionTargetsSorted(list);
  if (!rows.length) return '<p>No mohalla collection targets recorded.</p>';
  return rows.map((row) => mohallaCollectionTargetHtml(row)).join('');
}

export function mohallaCollectionTargetSummaryText(list, month) {
  const wanted = text(month);
  const rows = wanted ? targetsForMonth(list, wanted) : mohallaCollectionTargetsSorted(list);
  if (!rows.length) return 'No mohalla collection targets recorded.';
  const target = rows.reduce((sum, row) => sum + row.targetCents, 0);
  const actual = rows.reduce((sum, row) => sum + row.actualCents, 0);
  const hit = rows.filter((row) => targetStatus(row) === 'hit').length;
  const label = wanted ? `for ${wanted}` : 'overall';
  return `${rows.length} mohalla target(s) ${label}: target ${formatAmount(target)}, actual ${formatAmount(actual)}, ${hit} hit, ${rows.length - hit} missed.`;
}

function csvCell(value) {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function mohallaCollectionTargetCsv(list) {
  const rows = mohallaCollectionTargetsSorted(list);
  const lines = ['id,mohalla,month,target_cents,actual_cents,difference_cents,status'];
  for (const row of rows) {
    const difference = row.actualCents - row.targetCents;
    lines.push([row.id, row.mohalla, row.month, row.targetCents, row.actualCents, difference, targetStatus(row)].map(csvCell).join(','));
  }
  return lines.join('\n');
}

export function mohallaCollectionTargetFilename() {
  return 'mohalla-collection-targets.csv';
}
