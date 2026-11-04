// Plan 118 (Plan 101-202) — Payment-method reconciliation.
//
// Cash, bank transfer, and mobile-wallet collections used to be
// lumped into one total, so a shortfall in one method hid inside a
// surplus in another. This module is the per-method, per-period
// view: for one month it totals the ledger (the payments actually
// recorded) per method, sets the counted or confirmed total beside
// it, and lists every difference with its method and amount.
//
// The fences, stated plainly:
//   - It records no payment and changes no payment record. Every
//     input is caller-supplied; the module only reads the rows it
//     is given and returns new objects. A difference is reconciled
//     by an explanation note stored in its own list — never by an
//     edit to a payment, a bill, or a total.
//   - It is separate from the preferred-channel record (Plan 40):
//     that record says how a customer prefers to pay; this view
//     says how money actually arrived, per method, in a period.
//     The preferred-channel store is never read or written here.
//   - Money is integer cents throughout. A plain rupees figure
//     converts exactly once on the way in; a figure already in
//     cents passes through as-is. A method total is never
//     zero-filled: a method with no confirmed total shows a null
//     confirmed figure and a null difference, never a difference
//     of zero pretending the method was checked.
//   - Rows that cannot be used — voided rows, rows with no usable
//     amount, rows with no real payment date — are never silently
//     dropped from the view: voided rows are counted separately,
//     and unusable rows are listed by id so the operator can see
//     exactly what the totals do not cover.
//
// Method grouping: the app's payment methods fall into three
// groups — cash (Cash and every "Cash at … shop" variant),
// bank transfer (Bank Transfer, Raast), and mobile wallet
// (JazzCash, Easypaisa, NayaPay). A method outside those groups
// keeps its own recorded label as its own row, never coerced into
// a group it does not belong to.

const MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export const METHOD_GROUPS = Object.freeze({
  cash: 'Cash',
  bank_transfer: 'Bank transfer',
  mobile_wallet: 'Mobile wallet',
});

const GROUP_ORDER = ['cash', 'bank_transfer', 'mobile_wallet'];

const CASH_ALIASES = new Set(['cash']);
const BANK_ALIASES = new Set(['bank transfer', 'banktransfer', 'bank_transfer', 'raast']);
const WALLET_ALIASES = new Set(['jazzcash', 'easypaisa', 'nayapay', 'mobile wallet', 'mobilewallet', 'mobile_wallet', 'wallet']);

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function csvCell(value) {
  const s = String(value ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function validReconMonth(value) {
  if (typeof value !== 'string') return null;
  const m = MONTH_RE.exec(value.trim());
  return m ? `${m[1]}-${m[2]}` : null;
}

export function validReconDate(value) {
  if (typeof value !== 'string') return null;
  const m = DATE_RE.exec(value.trim());
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const d = new Date(Date.UTC(year, month - 1, day));
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

// A rupees figure converts to cents exactly once; a figure
// already in cents passes through as-is. Anything else —
// blank, non-numeric, negative, fractional cents — is unusable
// and returns null, never a guessed zero.
export function amountToCents(value, centsValue) {
  if (centsValue !== undefined && centsValue !== null && centsValue !== '') {
    const cents = Number(centsValue);
    if (!Number.isFinite(cents) || cents < 0 || !Number.isInteger(cents)) return null;
    return cents;
  }
  if (value === null || value === undefined || value === '') return null;
  const rupees = Number(value);
  if (!Number.isFinite(rupees) || rupees < 0) return null;
  const cents = Math.round(rupees * 100);
  if (!Number.isInteger(cents)) return null;
  return cents;
}

// Canonical group key for a recorded method label. Cash-shop
// variants group under cash; anything unrecognised keeps its own
// lower-cased label as its key, so it is never forced into a
// group it does not belong to.
export function methodGroupKey(method) {
  const raw = text(method);
  if (!raw) return null;
  const key = raw.toLowerCase().replace(/[\s-]+/g, ' ').trim();
  if (CASH_ALIASES.has(key) || key.startsWith('cash at ')) return 'cash';
  if (BANK_ALIASES.has(key)) return 'bank_transfer';
  if (WALLET_ALIASES.has(key)) return 'mobile_wallet';
  return key;
}

export function methodGroupLabel(key) {
  if (Object.prototype.hasOwnProperty.call(METHOD_GROUPS, key)) return METHOD_GROUPS[key];
  return key;
}

// One normalised payment row, or null when the row cannot be
// used at all (no method, no usable amount, no real date).
// Voided rows are normalised with voided: true so the caller
// can count them apart instead of counting them as money.
export function normalizePaymentRow(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const methodKey = methodGroupKey(raw.method ?? raw.methodKey);
  if (!methodKey) return null;
  const amountCents = amountToCents(raw.amount, raw.amountCents);
  if (amountCents === null) return null;
  const date = validReconDate(raw.date);
  if (!date) return null;
  return {
    id: text(raw.id),
    methodKey,
    methodLabel: methodGroupLabel(methodKey),
    amountCents,
    date,
    voided: raw.voided === true || text(raw.status).toLowerCase() === 'void',
  };
}

// One normalised confirmed total, or null when half-formed
// (no method, no usable amount). A confirmed total of zero is a
// real figure — the method was counted and came to nothing —
// so zero is kept, never treated as missing.
export function normalizeConfirmedTotal(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const methodKey = methodGroupKey(raw.method ?? raw.methodKey);
  if (!methodKey) return null;
  const amountCents = amountToCents(raw.amount, raw.amountCents);
  if (amountCents === null) return null;
  return { methodKey, methodLabel: methodGroupLabel(methodKey), amountCents };
}

function normalizeConfirmedList(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const raw of list) {
    const item = normalizeConfirmedTotal(raw);
    if (item) out.push(item);
  }
  return out;
}

// Build the reconciliation for one period from caller-supplied
// payment rows and confirmed totals. Rows outside the period
// never enter the totals; rows inside it that cannot be used
// are listed under `unusable` with a plain reason, and voided
// rows inside the period are counted under `voidedSkipped` —
// neither group is silently dropped from the view. Method
// totals sum exactly to `ledgerTotalCents` over the usable
// rows, and every nonzero difference is listed with its method
// and amount. A method with no confirmed total has a null
// confirmed figure and a null difference, never a zero that
// pretends it was checked.
export function buildMethodReconciliation(payments, confirmed, period) {
  const month = validReconMonth(period);
  if (!month) return null;
  const confirmedMap = new Map();
  for (const item of normalizeConfirmedList(confirmed)) {
    confirmedMap.set(item.methodKey, item.amountCents);
  }
  const rows = new Map();
  const unusable = [];
  let voidedSkipped = 0;
  const list = Array.isArray(payments) ? payments : [];
  for (const raw of list) {
    if (!raw || typeof raw !== 'object') { unusable.push({ id: '', reason: 'Row is not a payment record.' }); continue; }
    const id = text(raw.id);
    const date = validReconDate(raw.date);
    if (!date) { unusable.push({ id, reason: 'No real payment date recorded.' }); continue; }
    if (date.slice(0, 7) !== month) continue;
    if (raw.voided === true || text(raw.status).toLowerCase() === 'void') { voidedSkipped += 1; continue; }
    const row = normalizePaymentRow(raw);
    if (!row) { unusable.push({ id, reason: 'No usable method or amount recorded.' }); continue; }
    const entry = rows.get(row.methodKey) ?? {
      methodKey: row.methodKey,
      methodLabel: row.methodLabel,
      ledgerCents: 0,
      paymentCount: 0,
    };
    entry.ledgerCents += row.amountCents;
    entry.paymentCount += 1;
    rows.set(row.methodKey, entry);
  }
  for (const [methodKey, amountCents] of confirmedMap) {
    if (!rows.has(methodKey)) {
      rows.set(methodKey, {
        methodKey,
        methodLabel: methodGroupLabel(methodKey),
        ledgerCents: 0,
        paymentCount: 0,
      });
    }
  }
  const methodRows = [...rows.values()].map((entry) => {
    const confirmedCents = confirmedMap.has(entry.methodKey) ? confirmedMap.get(entry.methodKey) : null;
    return {
      ...entry,
      confirmedCents,
      differenceCents: confirmedCents === null ? null : confirmedCents - entry.ledgerCents,
    };
  });
  methodRows.sort((a, b) => {
    const orderA = GROUP_ORDER.includes(a.methodKey) ? GROUP_ORDER.indexOf(a.methodKey) : GROUP_ORDER.length;
    const orderB = GROUP_ORDER.includes(b.methodKey) ? GROUP_ORDER.indexOf(b.methodKey) : GROUP_ORDER.length;
    return (orderA - orderB) || a.methodLabel.localeCompare(b.methodLabel);
  });
  const ledgerTotalCents = methodRows.reduce((sum, row) => sum + row.ledgerCents, 0);
  const checkedRows = methodRows.filter((row) => row.confirmedCents !== null);
  const confirmedTotalCents = checkedRows.reduce((sum, row) => sum + row.confirmedCents, 0);
  const differences = methodRows.filter((row) => row.differenceCents !== null && row.differenceCents !== 0);
  return {
    period: month,
    rows: methodRows,
    ledgerTotalCents,
    confirmedTotalCents,
    differences,
    unusable,
    voidedSkipped,
  };
}

export function reconciliationSummaryText(recon) {
  if (!recon) return 'No reconciliation built: pick a real month.';
  const checked = recon.rows.filter((row) => row.confirmedCents !== null).length;
  const parts = [
    `${recon.period}: ledger Rs. ${(recon.ledgerTotalCents / 100).toFixed(2)} across ${recon.rows.length} method(s)`,
    `${checked} method(s) with a confirmed total`,
    recon.differences.length
      ? `${recon.differences.length} difference(s) to explain`
      : 'no differences',
  ];
  if (recon.voidedSkipped) parts.push(`${recon.voidedSkipped} voided row(s) excluded`);
  if (recon.unusable.length) parts.push(`${recon.unusable.length} unusable row(s) listed, not counted`);
  return parts.join('; ') + '.';
}

function rupees(cents) {
  return `Rs. ${(cents / 100).toFixed(2)}`;
}

function methodRowHtml(row) {
  const confirmed = row.confirmedCents === null ? 'Not confirmed' : rupees(row.confirmedCents);
  const difference = row.differenceCents === null
    ? 'Not checked'
    : row.differenceCents === 0
      ? 'Matches'
      : `${row.differenceCents > 0 ? 'Surplus' : 'Shortfall'} ${rupees(Math.abs(row.differenceCents))}`;
  return `<p><strong>${escapeHtml(row.methodLabel)}</strong> — ledger ${escapeHtml(rupees(row.ledgerCents))}`
    + ` (${row.paymentCount} payment(s)) — confirmed ${escapeHtml(confirmed)} — difference: ${escapeHtml(difference)}</p>`;
}

export function methodReconciliationHtml(recon) {
  if (!recon) return '<p>No reconciliation built: pick a real month.</p>';
  const lines = [`<p><strong>${escapeHtml(recon.period)}</strong> — ledger total ${escapeHtml(rupees(recon.ledgerTotalCents))}</p>`];
  lines.push(...recon.rows.map(methodRowHtml));
  if (recon.differences.length) {
    lines.push('<p><strong>Differences to explain:</strong></p>');
    for (const row of recon.differences) {
      lines.push(`<p>${escapeHtml(row.methodLabel)}: ${row.differenceCents > 0 ? 'surplus' : 'shortfall'} ${escapeHtml(rupees(Math.abs(row.differenceCents)))}</p>`);
    }
  }
  if (recon.unusable.length) {
    lines.push('<p><strong>Unusable rows (not counted):</strong></p>');
    for (const row of recon.unusable) {
      lines.push(`<p>${escapeHtml(row.id || '(no id)')} — ${escapeHtml(row.reason)}</p>`);
    }
  }
  return lines.join('');
}

export function methodReconciliationCsv(recon) {
  if (!recon) return 'period,method,ledger_cents,confirmed_cents,difference_cents,payment_count\n';
  const head = 'period,method,ledger_cents,confirmed_cents,difference_cents,payment_count';
  const rows = recon.rows.map((row) => [
    recon.period,
    row.methodLabel,
    row.ledgerCents,
    row.confirmedCents === null ? '' : row.confirmedCents,
    row.differenceCents === null ? '' : row.differenceCents,
    row.paymentCount,
  ].map(csvCell).join(','));
  return [head, ...rows].join('\n');
}

export function methodReconciliationFilename(period) {
  const month = validReconMonth(period);
  return month ? `method-reconciliation-${month}.csv` : 'method-reconciliation.csv';
}

// Explanation notes: reconciling a difference records a note,
// never an edit to a payment. A note needs its period, its
// method, a nonzero difference to explain, a non-blank note,
// and a real date; anything less is refused and the list is
// left exactly unchanged. A duplicate note id is never
// rewritten — an identical re-save leaves the list unchanged,
// different figures for the same id are refused.
export function normalizeMethodNote(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = text(raw.id);
  const period = validReconMonth(raw.period);
  const methodKey = methodGroupKey(raw.method ?? raw.methodKey);
  const note = text(raw.note);
  const date = validReconDate(raw.date);
  if (!id || !period || !methodKey || !note || !date) return null;
  const differenceCents = Number(raw.differenceCents);
  if (!Number.isInteger(differenceCents) || differenceCents === 0) return null;
  return {
    id,
    period,
    methodKey,
    methodLabel: methodGroupLabel(methodKey),
    differenceCents,
    note,
    date,
  };
}

export function normalizeMethodNoteList(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const raw of list) {
    const item = normalizeMethodNote(raw);
    if (item) out.push(item);
  }
  return out;
}

export function addMethodNote(list, raw) {
  const item = normalizeMethodNote(raw);
  const base = normalizeMethodNoteList(list);
  if (!item) return base;
  const existing = base.find((entry) => entry.id === item.id);
  if (existing) {
    if (JSON.stringify(existing) === JSON.stringify(item)) return base;
    return base;
  }
  return [...base, item];
}

export function notesForMethod(list, methodKey) {
  const key = methodGroupKey(methodKey);
  if (!key) return [];
  return normalizeMethodNoteList(list).filter((entry) => entry.methodKey === key);
}

export function methodNoteHtml(note) {
  const direction = note.differenceCents > 0 ? 'surplus' : 'shortfall';
  return `<p><strong>${escapeHtml(note.methodLabel)}</strong> (${escapeHtml(note.period)}) — ${direction} `
    + `${escapeHtml(rupees(Math.abs(note.differenceCents)))} — ${escapeHtml(note.note)} (${escapeHtml(note.date)})</p>`;
}

export function methodNoteCsv(list) {
  const items = normalizeMethodNoteList(list);
  const head = 'id,period,method,difference_cents,note,date';
  const rows = items.map((note) => [
    note.id,
    note.period,
    note.methodLabel,
    note.differenceCents,
    note.note,
    note.date,
  ].map(csvCell).join(','));
  return [head, ...rows].join('\n');
}

export function methodNoteFilename() {
  return 'method-reconciliation-notes.csv';
}
