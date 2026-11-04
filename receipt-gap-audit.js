// Plan 91 (Plan 1-100) — Receipt-number gap audit (missing numbers,
// explained).
//
// READ-ONLY SEQUENCE AUDIT. This module never creates a receipt,
// deletes one, or changes any payment: it answers one question —
// "in the checked run of receipt numbers, which numbers are missing,
// and is each missing number voided, explained, or still
// unexplained?" — so a skipped, deleted, or never-issued number
// leaves a visible trace instead of a silent hole in which a cash
// payment can quietly disappear.
//
// Why the module takes caller-supplied numbers: the app's generated
// receipt references are REC-YYMM-CCCC-XXXX strings, not a plain
// integer run, so there is no existing integer receipt sequence to
// read. The audit therefore works over the numbers the caller
// supplies — plain-integer receipt numbers the operator actually
// issued (field receipts typed with a plain number), plus voided
// numbers from the Plan K void log where the voided payment still
// carries its receipt number. Numbers are never invented: a number
// that is not supplied is not in the range, and a range with no
// numbers at all audits as empty, never as zero-filled.
//
// Statuses for a gap (exactly the plan's three, in precedence order):
//   voided     — the number has a Plan K void record; the record's
//                reason and date are shown, never a blank.
//   explained  — the operator recorded a note for the number in
//                this plan's own explanation store.
//   unexplained — neither of the above; it stays visible until the
//                operator records an explanation.
// A voided number beats an explained one: the void record is the
// fact, the note is only commentary.
//
// Issued numbers carry their Plan 5 receipt delivery status where
// the caller supplies one (generated / pending / sent / failed),
// only to show whether that numbered receipt reached the customer.
// The delivery catalogue is restated here, not imported, because
// this module is import-free by design (like cash-in-hand.js and
// pattern-watch.js): it never reads storage, the clock, or the
// network, and never mutates its inputs.
//
// The module is import-free by design, so the Analytics panel can
// use it without pulling in the app graph. It names no store: the
// explanation list lives in the panel's own browser-storage key and
// is passed in as plain data.

export const RECEIPT_GAP_STATUSES = Object.freeze([
  'voided',
  'explained',
  'unexplained',
]);

export const RECEIPT_GAP_STATUS_LABELS = Object.freeze({
  voided: 'Voided',
  explained: 'Explained',
  unexplained: 'Unexplained',
});

// Plan 5 delivery catalogue, restated (see receipt-delivery.js).
export const RECEIPT_DELIVERY_STATUSES = Object.freeze([
  'generated',
  'pending',
  'sent',
  'failed',
]);

export const RECEIPT_DELIVERY_STATUS_LABELS = Object.freeze({
  generated: 'Generated',
  pending: 'Pending',
  sent: 'Sent',
  failed: 'Failed',
});

const text = (value) => (typeof value === 'string' ? value.trim() : '');
const isRecord = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

/** True when the value is a positive safe integer receipt number. */
export function isReceiptNumber(value) {
  return Number.isSafeInteger(value) && value > 0;
}

/**
 * A plain-integer receipt number from a stored reference, or null.
 * Only a reference that is exactly digits counts — a generated
 * REC-YYMM-CCCC-XXXX reference never parses as a number here, so
 * generated references are never mistaken for a sequence number.
 */
export function receiptNumberFromReference(value) {
  const ref = text(value);
  if (!/^\d+$/.test(ref)) return null;
  const number = Number(ref);
  return isReceiptNumber(number) ? number : null;
}

/** True when the value is one of the three gap statuses. */
export function isReceiptGapStatus(value) {
  return RECEIPT_GAP_STATUSES.includes(value);
}

/** True when the value is one of the four Plan 5 delivery statuses. */
export function isReceiptDeliveryStatus(value) {
  return RECEIPT_DELIVERY_STATUSES.includes(value);
}

/** Human label for a gap status; unknown values read as 'Unexplained'. */
export function receiptGapStatusLabel(status) {
  return RECEIPT_GAP_STATUS_LABELS[status] || RECEIPT_GAP_STATUS_LABELS.unexplained;
}

/** Human label for a delivery status; unknown values read as 'Not recorded'. */
export function receiptDeliveryStatusLabel(status) {
  return RECEIPT_DELIVERY_STATUS_LABELS[status] || 'Not recorded';
}

/**
 * Normalises one issued receipt row. Unusable rows (no positive
 * integer number) are dropped, never counted on a guessed figure.
 * A delivery status outside the Plan 5 catalogue becomes null, so
 * an unknown status is shown as 'not recorded', never invented.
 */
export function normalizeReceiptEntry(value) {
  if (!isRecord(value)) return null;
  const number = value.number;
  if (!isReceiptNumber(number)) return null;
  const deliveryStatus = isReceiptDeliveryStatus(value.deliveryStatus) ? value.deliveryStatus : null;
  return {
    number,
    customer: text(value.customer),
    customerId: text(value.customerId),
    date: text(value.date),
    deliveryStatus,
  };
}

/** Normalises a list of issued receipt rows, sorted by number. */
export function normalizeReceiptEntries(values) {
  if (!Array.isArray(values)) return [];
  const out = [];
  const seen = new Set();
  for (const value of values) {
    const row = normalizeReceiptEntry(value);
    if (!row || seen.has(row.number)) continue;
    seen.add(row.number);
    out.push(row);
  }
  out.sort((a, b) => a.number - b.number);
  return out;
}

/**
 * Normalises one void record for a receipt number. A void without a
 * number or without a reason is dropped: a voided gap must show its
 * void record, and a record with neither is not a record.
 */
export function normalizeVoidEntry(value) {
  if (!isRecord(value)) return null;
  const number = value.number;
  if (!isReceiptNumber(number)) return null;
  const reason = text(value.reason) || text(value.voidReason);
  if (!reason) return null;
  return {
    number,
    reason,
    date: text(value.date) || text(value.voidedAt),
  };
}

/** Normalises a list of void records, one per number (first wins). */
export function normalizeVoidEntries(values) {
  if (!Array.isArray(values)) return [];
  const out = [];
  const seen = new Set();
  for (const value of values) {
    const row = normalizeVoidEntry(value);
    if (!row || seen.has(row.number)) continue;
    seen.add(row.number);
    out.push(row);
  }
  out.sort((a, b) => a.number - b.number);
  return out;
}

/**
 * Normalises one operator explanation for a gap number. An
 * explanation without a number or without a note is dropped: an
 * unexplained gap stays unexplained until a real note is recorded.
 */
export function normalizeExplanation(value) {
  if (!isRecord(value)) return null;
  const number = value.number;
  if (!isReceiptNumber(number)) return null;
  const note = text(value.note);
  if (!note) return null;
  return { number, note, by: text(value.by) };
}

/** Normalises a list of explanations, one per number (first wins). */
export function normalizeExplanations(values) {
  if (!Array.isArray(values)) return [];
  const out = [];
  const seen = new Set();
  for (const value of values) {
    const row = normalizeExplanation(value);
    if (!row || seen.has(row.number)) continue;
    seen.add(row.number);
    out.push(row);
  }
  out.sort((a, b) => a.number - b.number);
  return out;
}

/**
 * Builds the sequence audit for one run of receipt numbers.
 *
 * The checked range runs from the smallest to the largest number
 * among the issued receipts and the void records — a voided number
 * is a consumed number, so it extends the range even when no live
 * receipt carries it. Every integer inside the range that is not
 * issued is a gap, with exactly one status: voided (void record
 * shown), explained (operator note shown), or unexplained.
 *
 * A number that is both issued and voided is issued: the live
 * receipt is the fact, and the void record for it is not also a
 * gap — the same number is never counted twice. With no numbers
 * at all the audit is empty (range null), never zero-filled.
 *
 * @returns {{range: {from:number,to:number}|null, issued: Array,
 *   gaps: Array<{number,status,voidReason,voidDate,note,by}>,
 *   summary: {issued:number,voided:number,explained:number,
 *   unexplained:number,total:number}}}
 */
export function buildGapAudit({ receipts = [], voids = [], explanations = [] } = {}) {
  const issued = normalizeReceiptEntries(receipts);
  const voidList = normalizeVoidEntries(voids);
  const explanationList = normalizeExplanations(explanations);
  const voidsByNumber = new Map(voidList.map((row) => [row.number, row]));
  const explanationsByNumber = new Map(explanationList.map((row) => [row.number, row]));
  const issuedNumbers = new Set(issued.map((row) => row.number));
  const allNumbers = [...issuedNumbers, ...voidList.map((row) => row.number)];
  if (allNumbers.length === 0) {
    return {
      range: null,
      issued,
      gaps: [],
      summary: { issued: 0, voided: 0, explained: 0, unexplained: 0, total: 0 },
    };
  }
  const from = Math.min(...allNumbers);
  const to = Math.max(...allNumbers);
  const gaps = [];
  for (let number = from; number <= to; number += 1) {
    if (issuedNumbers.has(number)) continue;
    const voidRow = voidsByNumber.get(number);
    if (voidRow) {
      gaps.push({
        number,
        status: 'voided',
        voidReason: voidRow.reason,
        voidDate: voidRow.date,
        note: '',
        by: '',
      });
      continue;
    }
    const explanation = explanationsByNumber.get(number);
    if (explanation) {
      gaps.push({
        number,
        status: 'explained',
        voidReason: '',
        voidDate: '',
        note: explanation.note,
        by: explanation.by,
      });
      continue;
    }
    gaps.push({
      number,
      status: 'unexplained',
      voidReason: '',
      voidDate: '',
      note: '',
      by: '',
    });
  }
  const summary = {
    issued: issued.length,
    voided: gaps.filter((gap) => gap.status === 'voided').length,
    explained: gaps.filter((gap) => gap.status === 'explained').length,
    unexplained: gaps.filter((gap) => gap.status === 'unexplained').length,
    total: gaps.length,
  };
  return { range: { from, to }, issued, gaps, summary };
}

/** Gaps of one status only; 'all' (or anything else) returns every gap. */
export function filterGaps(gaps, status) {
  if (!Array.isArray(gaps)) return [];
  if (!isReceiptGapStatus(status)) return [...gaps];
  return gaps.filter((gap) => gap.status === status);
}

/** Unexplained gaps only — the numbers still needing an explanation. */
export function unexplainedGaps(gaps) {
  return filterGaps(gaps, 'unexplained');
}

/** One-line summary text for an audit, or a plain empty-range note. */
export function gapSummaryText(audit) {
  if (!audit || !audit.range) return 'No numbered receipts found — nothing to audit.';
  const { from, to } = audit.range;
  const { issued, voided, explained, unexplained } = audit.summary;
  return `Numbers ${from}–${to}: ${issued} issued, ${voided} voided, ${explained} explained, ${unexplained} unexplained gap${unexplained === 1 ? '' : 's'}.`;
}

/**
 * Records (or replaces) an explanation for a gap number. Returns a
 * new list; the input list is never mutated. An explanation without
 * a number or a note leaves the list unchanged.
 */
export function explainGap(explanations, value) {
  const list = normalizeExplanations(explanations);
  const row = normalizeExplanation(value);
  if (!row) return list;
  return [...list.filter((entry) => entry.number !== row.number), row]
    .sort((a, b) => a.number - b.number);
}

/** Removes the explanation for a number, returning a new list. */
export function removeExplanation(explanations, number) {
  const list = normalizeExplanations(explanations);
  if (!isReceiptNumber(number)) return list;
  return list.filter((entry) => entry.number !== number);
}

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

/** HTML table of the gaps, or a plain note when there are none. */
export function gapAuditHtml(audit) {
  if (!audit || !audit.range) return '<p class="phase3-note">No numbered receipts found — nothing to audit.</p>';
  if (audit.gaps.length === 0) {
    return `<p class="phase3-note">Numbers ${audit.range.from}–${audit.range.to}: no gaps — every number in the run is accounted for.</p>`;
  }
  const rows = audit.gaps.map((gap) => {
    const detail = gap.status === 'voided'
      ? `Void: ${escapeHtml(gap.voidReason)}${gap.voidDate ? ` (${escapeHtml(gap.voidDate)})` : ''}`
      : gap.status === 'explained'
        ? `Note: ${escapeHtml(gap.note)}${gap.by ? ` — ${escapeHtml(gap.by)}` : ''}`
        : 'No void record, no note yet';
    return `<tr><td>${gap.number}</td><td>${escapeHtml(receiptGapStatusLabel(gap.status))}</td><td>${detail}</td></tr>`;
  }).join('');
  return `<table class="phase3-table"><thead><tr><th>Number</th><th>Status</th><th>Detail</th></tr></thead><tbody>${rows}</tbody></table>`;
}

/** HTML table of the issued numbers with their delivery status. */
export function issuedReceiptsHtml(audit) {
  if (!audit || audit.issued.length === 0) return '<p class="phase3-note">No issued numbered receipts in this run.</p>';
  const rows = audit.issued.map((row) => `<tr><td>${row.number}</td><td>${escapeHtml(row.customer || '—')}</td><td>${escapeHtml(row.date || '—')}</td><td>${escapeHtml(receiptDeliveryStatusLabel(row.deliveryStatus))}</td></tr>`).join('');
  return `<table class="phase3-table"><thead><tr><th>Number</th><th>Customer</th><th>Date</th><th>Reached customer</th></tr></thead><tbody>${rows}</tbody></table>`;
}

const csvCell = (value) => {
  const cell = String(value ?? '');
  return /[",\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell;
};

/** CSV of the gaps: number, status, detail. */
export function gapAuditCsv(audit) {
  const lines = ['number,status,detail'];
  if (audit && Array.isArray(audit.gaps)) {
    for (const gap of audit.gaps) {
      const detail = gap.status === 'voided'
        ? `Void: ${gap.voidReason}${gap.voidDate ? ` (${gap.voidDate})` : ''}`
        : gap.status === 'explained'
          ? `Note: ${gap.note}${gap.by ? ` — ${gap.by}` : ''}`
          : 'Unexplained';
      lines.push([gap.number, gap.status, csvCell(detail)].join(','));
    }
  }
  return `${lines.join('\n')}\n`;
}

/** Stable CSV filename for an audit. */
export function gapAuditFilename(audit) {
  if (!audit || !audit.range) return 'receipt-gap-audit.csv';
  return `receipt-gap-audit-${audit.range.from}-${audit.range.to}.csv`;
}
