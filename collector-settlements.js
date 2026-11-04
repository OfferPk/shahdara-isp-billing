// Plan 129 (Plan 101-202) — Collector settlement statement:
// one signed statement per collector per period, instead of a pile
// of day sheets that has to be re-added by hand at settling time.
//
// This module is the STATEMENT only, and nothing else:
//
//   - It is pure and import-free: the caller supplies every figure,
//     and the module never reads storage, the clock, or the network,
//     never imports another module, and never mutates an input.
//     Recording a statement changes no payment, no handover, and no
//     count of any kind — the statement only reads the figures it is
//     given and proves whether they agree.
//   - One statement per collector per period: a second statement for
//     the same collector and period is refused outright, so a period
//     can never carry two answers. A duplicate id is likewise never
//     rewritten (an identical re-save is unchanged, different figures
//     are refused).
//   - The identity the statement proves, in plain words: collected
//     minus handed over minus pending items equals the cash that
//     should still be in hand. The statement's own cash-in-hand
//     figure is compared against that expected figure, and any
//     difference is named plainly — a shortfall when cash in hand is
//     less than expected, an excess when it is more — never hidden
//     by editing a figure.
//   - Every figure can be checked against its source: the caller
//     supplies the day-sheet or ledger totals for the same period,
//     and the check reports, field by field, which figures match,
//     which do not, and which could not be checked because the
//     source figure was unusable. A figure that does not match is
//     named, never silently corrected.
//   - Signing is a separate, one-way act: a statement may be signed
//     once, with a signer and a real date, and a signed statement is
//     never re-signed. An unsigned statement is shown as unsigned,
//     never as signed by somebody.
//   - Periods are YYYY-MM months and dates are real YYYY-MM-DD
//     calendar dates (2026-02-30 is rejected, never guessed).
//     Half-formed statements are refused outright, never stored
//     half-formed. Amounts are integer cents: a plain rupees figure
//     converts exactly once, a `*Cents` figure passes through as-is,
//     and anything else is refused. All four money figures must be
//     zero or positive — a statement never carries a negative
//     collection, handover, pending amount, or cash in hand.

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Strict calendar date: YYYY-MM-DD that really exists, or null. */
export function validSettlementDate(value) {
  if (typeof value !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1) return null;
  const daysInMonth = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  return day <= daysInMonth ? value : null;
}

/** Strict period month: YYYY-MM with a real month, or null. */
export function validSettlementMonth(value) {
  if (typeof value !== 'string') return null;
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) return null;
  const month = Number(match[2]);
  return month >= 1 && month <= 12 ? value : null;
}

function cleanText(value) {
  if (value === null || value === undefined) return '';
  return String(value).normalize('NFKC').trim();
}

function amountCentsFor(record, centsKey, rupeesKey) {
  if (!record || typeof record !== 'object') return null;
  if (Number.isInteger(record[centsKey])) return record[centsKey];
  const raw = record[rupeesKey];
  if (typeof raw === 'number' && Number.isFinite(raw)) return Math.round(raw * 100);
  if (typeof raw === 'string' && raw.trim() !== '') {
    const parsed = Number(raw.trim());
    if (Number.isFinite(parsed)) return Math.round(parsed * 100);
  }
  return null;
}

/**
 * One money figure to integer cents, without ever guessing the unit:
 * an integer `*Cents` figure is used as-is, while a plain rupees
 * figure converts exactly once (×100). Anything else is null.
 */
export function settlementAmountCents(value) {
  if (!value || typeof value !== 'object') return null;
  return amountCentsFor(value, 'amountCents', 'amount');
}

// Only these keys ever survive normalisation. Anything else on the
// input — including any payment, handover, or count field — is
// dropped, so a statement can never grow into another record.
const SETTLEMENT_KEYS = ['id', 'collector', 'collectorName', 'period', 'statementDate', 'collectedCents', 'handedOverCents', 'pendingCents', 'cashInHandCents', 'preparedBy', 'signedBy', 'signedDate', 'note'];

export function normalizeSettlement(record) {
  if (!record || typeof record !== 'object') return null;
  const id = cleanText(record.id);
  const collector = cleanText(record.collector);
  const period = validSettlementMonth(record.period);
  const statementDate = validSettlementDate(record.statementDate);
  const collectedCents = amountCentsFor(record, 'collectedCents', 'collected');
  const handedOverCents = amountCentsFor(record, 'handedOverCents', 'handedOver');
  const pendingCents = amountCentsFor(record, 'pendingCents', 'pending');
  const cashInHandCents = amountCentsFor(record, 'cashInHandCents', 'cashInHand');
  if (!id || !collector || !period || !statementDate) return null;
  if (collectedCents === null || handedOverCents === null || pendingCents === null || cashInHandCents === null) return null;
  if (collectedCents < 0 || handedOverCents < 0 || pendingCents < 0 || cashInHandCents < 0) return null;
  const signedDate = record.signedDate === '' || record.signedDate === null || record.signedDate === undefined
    ? ''
    : validSettlementDate(record.signedDate);
  if (record.signedDate !== '' && record.signedDate !== null && record.signedDate !== undefined && !signedDate) return null;
  const signedBy = cleanText(record.signedBy);
  if ((signedBy && !signedDate) || (!signedBy && signedDate)) return null;
  const out = {
    id,
    collector,
    collectorName: cleanText(record.collectorName),
    period,
    statementDate,
    collectedCents,
    handedOverCents,
    pendingCents,
    cashInHandCents,
    preparedBy: cleanText(record.preparedBy),
    signedBy,
    signedDate,
    note: cleanText(record.note),
  };
  // Prove the fence: the normalised record carries exactly the
  // allowed keys, nothing more.
  if (Object.keys(out).some((key) => !SETTLEMENT_KEYS.includes(key))) return null;
  return out;
}

export function normalizeSettlementList(list) {
  if (!Array.isArray(list)) return [];
  const kept = [];
  const seenIds = new Set();
  const seenCollectorPeriods = new Set();
  for (const item of list) {
    const record = normalizeSettlement(item);
    if (!record) continue;
    // First record wins, both for one id and for one collector and
    // period: a later statement can never silently replace the first.
    if (seenIds.has(record.id)) continue;
    const key = `${record.collector}::${record.period}`;
    if (seenCollectorPeriods.has(key)) continue;
    seenIds.add(record.id);
    seenCollectorPeriods.add(key);
    kept.push(record);
  }
  return kept;
}

/**
 * Add a statement. A duplicate id, or a second statement for the
 * same collector and period, leaves the list exactly unchanged —
 * the caller can tell by comparing lengths, and nothing is ever
 * silently replaced.
 */
export function upsertSettlement(list, record) {
  const normalized = normalizeSettlement(record);
  const base = normalizeSettlementList(list);
  if (!normalized) return base;
  if (base.some((item) => item.id === normalized.id)) return base;
  if (base.some((item) => item.collector === normalized.collector && item.period === normalized.period)) return base;
  return [...base, normalized];
}

export function removeSettlement(list, id) {
  const wanted = cleanText(id);
  if (!wanted) return normalizeSettlementList(list);
  return normalizeSettlementList(list).filter((item) => item.id !== wanted);
}

export function findSettlement(list, id) {
  const wanted = cleanText(id);
  if (!wanted) return null;
  return normalizeSettlementList(list).find((item) => item.id === wanted) || null;
}

export function settlementForCollectorPeriod(list, collector, period) {
  const wantedCollector = cleanText(collector);
  const wantedPeriod = validSettlementMonth(period);
  if (!wantedCollector || !wantedPeriod) return null;
  return normalizeSettlementList(list).find(
    (item) => item.collector === wantedCollector && item.period === wantedPeriod,
  ) || null;
}

/** One collector's statements, newest period first, then id A–Z. */
export function settlementsForCollector(list, collector) {
  const wanted = cleanText(collector);
  if (!wanted) return [];
  return normalizeSettlementList(list)
    .filter((item) => item.collector === wanted)
    .sort((a, b) => (a.period !== b.period ? (a.period < b.period ? 1 : -1) : (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)));
}

/**
 * The identity the statement proves: collected minus handed over
 * minus pending items is the cash that should still be in hand.
 * The difference is the statement's own cash-in-hand figure minus
 * that expected figure: zero means balanced, positive means excess
 * cash in hand, negative means a shortfall.
 */
export function settlementFigures(statement) {
  const record = normalizeSettlement(statement);
  if (!record) return null;
  const expectedInHandCents = record.collectedCents - record.handedOverCents - record.pendingCents;
  const differenceCents = record.cashInHandCents - expectedInHandCents;
  const status = differenceCents === 0 ? 'balanced' : (differenceCents < 0 ? 'shortfall' : 'excess');
  return {
    collectedCents: record.collectedCents,
    handedOverCents: record.handedOverCents,
    pendingCents: record.pendingCents,
    cashInHandCents: record.cashInHandCents,
    expectedInHandCents,
    differenceCents,
    status,
  };
}

export function settlementDifferenceLabel(figures) {
  if (!figures) return 'Not checkable';
  if (figures.status === 'balanced') return 'Balanced — cash in hand matches the expected figure exactly.';
  if (figures.status === 'shortfall') return `Shortfall of ${formatSettlementCents(-figures.differenceCents)} — cash in hand is less than expected.`;
  return `Excess of ${formatSettlementCents(figures.differenceCents)} — cash in hand is more than expected.`;
}

/**
 * Check every figure on a statement against caller-supplied source
 * totals for the same period (day sheets or ledger, as the caller
 * recorded them). Each field reports matched, mismatched, or
 * unchecked (the source figure was unusable, so no claim is made).
 * A mismatched figure is named with both figures, never corrected.
 */
export function verifySettlement(statement, sources) {
  const record = normalizeSettlement(statement);
  if (!record) return null;
  const fields = [
    { key: 'collected', label: 'Collected', statement: record.collectedCents },
    { key: 'handedOver', label: 'Handed over', statement: record.handedOverCents },
    { key: 'pending', label: 'Pending items', statement: record.pendingCents },
    { key: 'cashInHand', label: 'Cash still in hand', statement: record.cashInHandCents },
  ];
  const results = fields.map((field) => {
    const source = amountCentsFor(sources || {}, `${field.key}Cents`, field.key);
    if (source === null) return { field: field.key, label: field.label, result: 'unchecked', statement: field.statement, source: null };
    return {
      field: field.key,
      label: field.label,
      result: source === field.statement ? 'matched' : 'mismatched',
      statement: field.statement,
      source,
    };
  });
  return {
    matches: results.every((item) => item.result === 'matched'),
    results,
    mismatches: results.filter((item) => item.result === 'mismatched'),
    unchecked: results.filter((item) => item.result === 'unchecked'),
  };
}

/**
 * Sign a statement once. An already-signed statement, an unknown
 * id, a blank signer, or an unreal date leaves the list exactly
 * unchanged.
 */
export function signSettlement(list, id, signer, date) {
  const base = normalizeSettlementList(list);
  const wanted = cleanText(id);
  const signedBy = cleanText(signer);
  const signedDate = validSettlementDate(date);
  if (!wanted || !signedBy || !signedDate) return base;
  return base.map((item) => {
    if (item.id !== wanted) return item;
    if (item.signedBy || item.signedDate) return item;
    return { ...item, signedBy, signedDate };
  });
}

export function formatSettlementCents(cents) {
  if (!Number.isInteger(cents)) return '—';
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  return `${sign}Rs. ${(abs / 100).toFixed(2)}`;
}

export function settlementSummaryText(list, collector) {
  const rows = collector ? settlementsForCollector(list, collector) : normalizeSettlementList(list);
  if (rows.length === 0) return 'No settlement statement recorded.';
  const latest = [...rows].sort((a, b) => (a.period !== b.period ? (a.period < b.period ? 1 : -1) : 0))[0];
  const figures = settlementFigures(latest);
  return `${rows.length} settlement statement${rows.length === 1 ? '' : 's'}; latest ${latest.collector} ${latest.period}: ${settlementDifferenceLabel(figures)}`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function settlementHtml(list, collector) {
  const rows = collector ? settlementsForCollector(list, collector) : normalizeSettlementList(list).sort((a, b) => (a.period !== b.period ? (a.period < b.period ? 1 : -1) : (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)));
  if (rows.length === 0) return '<p>No settlement statement recorded.</p>';
  const body = rows.map((row) => {
    const figures = settlementFigures(row);
    const signed = row.signedBy ? `Signed by ${escapeHtml(row.signedBy)} on ${escapeHtml(row.signedDate)}` : 'Not yet signed';
    return `<tr><td>${escapeHtml(row.collectorName || row.collector)}</td><td>${escapeHtml(row.period)}</td><td>${formatSettlementCents(row.collectedCents)}</td><td>${formatSettlementCents(row.handedOverCents)}</td><td>${formatSettlementCents(row.pendingCents)}</td><td>${formatSettlementCents(row.cashInHandCents)}</td><td>${formatSettlementCents(figures.expectedInHandCents)}</td><td>${escapeHtml(settlementDifferenceLabel(figures))}</td><td>${signed}</td></tr>`;
  }).join('');
  return `<table><thead><tr><th>Collector</th><th>Period</th><th>Collected</th><th>Handed over</th><th>Pending items</th><th>Cash in hand</th><th>Expected in hand</th><th>Difference</th><th>Signature</th></tr></thead><tbody>${body}</tbody></table><p>Expected in hand = collected − handed over − pending items. A statement changes no payment, handover, or count — it only proves whether the figures agree. Print this page to keep a signed copy.</p>`;
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function settlementCsv(list, collector) {
  const rows = collector ? settlementsForCollector(list, collector) : normalizeSettlementList(list);
  const lines = rows.map((row) => {
    const figures = settlementFigures(row);
    return [row.id, row.collector, row.collectorName, row.period, row.statementDate, row.collectedCents, row.handedOverCents, row.pendingCents, row.cashInHandCents, figures.expectedInHandCents, figures.differenceCents, figures.status, row.preparedBy, row.signedBy, row.signedDate, row.note].map(csvCell).join(',');
  });
  return `id,collector,collector_name,period,statement_date,collected_cents,handed_over_cents,pending_cents,cash_in_hand_cents,expected_in_hand_cents,difference_cents,status,prepared_by,signed_by,signed_date,note\n${lines.join('\n')}${lines.length > 0 ? '\n' : ''}`;
}

export function settlementFilename() {
  return 'collector-settlements.csv';
}
