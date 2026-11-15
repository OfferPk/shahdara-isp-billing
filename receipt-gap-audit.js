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
// A STORED REC-YYMM-CCCC-XXXX reference is audited too, in its own
// month-and-customer run: the tail is a sequence only when it is
// all digits, so a run's range spans its integer tails and a gap is
// the full reference (REC-2611-0012-1002), never a bare integer.
// Non-numeric tails (a payment id's last four characters, e.g.
// EBB7) are real receipts, not holes: they are listed as issued
// and never gap-checked. A GENERATED reference — derived on display
// from a payment id — never enters the audit: its tail is the id's
// fingerprint, not a sequence, so feeding derived refs in would
// invent gaps between two real receipts. Only references actually
// stored on a payment reach the audit. A numeric tail is
// canonicalised to four digits (7 reads as 0007) so one receipt
// has one key however the tail was typed; live tails are already
// four characters, so nothing stored changes form.
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

/**
 * A stored REC-YYMM-CCCC-XXXX reference, parsed, or null. This is
 * the sibling of receiptNumberFromReference, which stays exactly as
 * it is (null for REC- refs — the ledger book filter depends on
 * that): this parser is the only place a REC- ref becomes a run.
 * The YYMM segment is the payment's month, CCCC the customer
 * number (four digits, more when the customer number is above
 * 9999), and XXXX the tail. The tail is an integer only when it is
 * all digits; a numeric tail is canonicalised to four digits so
 * one receipt has one key. Anything else — a plain integer, an
 * RCPT- number, a malformed string — returns null.
 */
export function parseReceiptReference(value) {
  const ref = text(value);
  const match = /^REC-(\d{4})-(\d{4,})-([A-Za-z0-9]{1,4})$/i.exec(ref);
  if (!match) return null;
  const [, yymm, customer, tailRaw] = match;
  const tail = /^\d+$/.test(tailRaw) ? tailRaw.padStart(4, '0') : tailRaw.toUpperCase();
  const tailNumber = /^\d+$/.test(tail) ? Number(tail) : null;
  return {
    ref: `REC-${yymm}-${customer}-${tail}`,
    runKey: `${yymm}-${customer}`,
    yymm,
    customer,
    tail,
    tailNumber: tailNumber !== null && Number.isSafeInteger(tailNumber) ? tailNumber : null,
  };
}

/** The stored REC- reference on a row, parsed, or null. */
const recRefOf = (row) => (isRecord(row)
  ? parseReceiptReference(row.ref ?? row.receiptNumber ?? row.reference)
  : null);

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
 * Normalises one issued receipt row carrying a stored REC-
 * reference. Unusable rows (no stored REC- ref) are dropped, never
 * counted on a guessed figure. The tail is an integer only when it
 * is all digits; a non-numeric tail still counts as issued, it is
 * just never gap-checked. A delivery status outside the Plan 5
 * catalogue becomes null, so an unknown status is shown as 'not
 * recorded', never invented.
 */
export function normalizeRecReceiptEntry(value) {
  if (!isRecord(value)) return null;
  const parsed = recRefOf(value);
  if (!parsed) return null;
  const deliveryStatus = isReceiptDeliveryStatus(value.deliveryStatus) ? value.deliveryStatus : null;
  return {
    ref: parsed.ref,
    runKey: parsed.runKey,
    yymm: parsed.yymm,
    customerNumber: parsed.customer,
    tail: parsed.tail,
    tailNumber: parsed.tailNumber,
    customer: text(value.customer),
    customerId: text(value.customerId),
    date: text(value.date),
    deliveryStatus,
  };
}

/** Normalises a list of stored-REC- issued rows, one per reference (first wins). */
export function normalizeRecReceiptEntries(values) {
  if (!Array.isArray(values)) return [];
  const out = [];
  const seen = new Set();
  for (const value of values) {
    const row = normalizeRecReceiptEntry(value);
    if (!row || seen.has(row.ref)) continue;
    seen.add(row.ref);
    out.push(row);
  }
  out.sort((a, b) => (a.runKey < b.runKey ? -1 : a.runKey > b.runKey ? 1
    : (a.tailNumber ?? Infinity) - (b.tailNumber ?? Infinity)
    || (a.tail < b.tail ? -1 : a.tail > b.tail ? 1 : 0)));
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
 * Normalises one void record carrying a stored REC- reference. A
 * void without a stored REC- ref or without a reason is dropped: a
 * voided gap must show its void record, and a record with neither
 * is not a record.
 */
export function normalizeRecVoidEntry(value) {
  if (!isRecord(value)) return null;
  const parsed = recRefOf(value);
  if (!parsed) return null;
  const reason = text(value.reason) || text(value.voidReason);
  if (!reason) return null;
  return {
    ref: parsed.ref,
    runKey: parsed.runKey,
    tail: parsed.tail,
    tailNumber: parsed.tailNumber,
    reason,
    date: text(value.date) || text(value.voidedAt),
  };
}

/** Normalises a list of stored-REC- void records, one per reference (first wins). */
export function normalizeRecVoidEntries(values) {
  if (!Array.isArray(values)) return [];
  const out = [];
  const seen = new Set();
  for (const value of values) {
    const row = normalizeRecVoidEntry(value);
    if (!row || seen.has(row.ref)) continue;
    seen.add(row.ref);
    out.push(row);
  }
  out.sort((a, b) => (a.runKey < b.runKey ? -1 : a.runKey > b.runKey ? 1
    : (a.tailNumber ?? Infinity) - (b.tailNumber ?? Infinity)
    || (a.tail < b.tail ? -1 : a.tail > b.tail ? 1 : 0)));
  return out;
}

/**
 * Normalises one operator explanation for a gap number. An
 * explanation without a number or without a note is dropped: an
 * unexplained gap stays unexplained until a real note is recorded.
 * A REC- gap is explained by its full reference instead of a
 * number — the reference is canonicalised, so a typed tail matches
 * the gap it explains however it was typed.
 */
export function normalizeExplanation(value) {
  if (!isRecord(value)) return null;
  const note = text(value.note);
  if (!note) return null;
  if (isReceiptNumber(value.number)) return { number: value.number, note, by: text(value.by) };
  const parsed = parseReceiptReference(value.ref ?? value.reference ?? value.number);
  if (parsed) return { ref: parsed.ref, runKey: parsed.runKey, note, by: text(value.by) };
  return null;
}

/** Sort order for explanations: plain numbers numerically, then REC- refs by reference. */
const byExplanationKey = (a, b) => {
  if (isReceiptNumber(a.number) && isReceiptNumber(b.number)) return a.number - b.number;
  if (a.ref && b.ref) return a.ref < b.ref ? -1 : a.ref > b.ref ? 1 : 0;
  return a.ref ? 1 : -1;
};

/** Normalises a list of explanations, one per number or reference (first wins). */
export function normalizeExplanations(values) {
  if (!Array.isArray(values)) return [];
  const out = [];
  const seen = new Set();
  for (const value of values) {
    const row = normalizeExplanation(value);
    if (!row) continue;
    const key = row.ref ?? row.number;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  out.sort(byExplanationKey);
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
 * Stored REC- references are audited alongside, one audit per
 * month-and-customer run, in the returned `runs` list: a run's
 * range spans only its integer tails, its gaps carry the full
 * reference, and non-numeric tails are listed as issued, never
 * gap-checked. A run with no integer tails audits as issued-only
 * (range null), never gap-filled. The plain run above is unchanged
 * by the presence of REC- rows.
 *
 * @returns {{range: {from:number,to:number}|null, issued: Array,
 *   gaps: Array<{number,status,voidReason,voidDate,note,by}>,
 *   summary: {issued:number,voided:number,explained:number,
 *   unexplained:number,total:number}, runs: Array}}
 */
export function buildGapAudit({ receipts = [], voids = [], explanations = [] } = {}) {
  const plainReceipts = [];
  const recReceipts = [];
  for (const row of Array.isArray(receipts) ? receipts : []) {
    if (recRefOf(row)) recReceipts.push(row);
    else plainReceipts.push(row);
  }
  const plainVoids = [];
  const recVoids = [];
  for (const row of Array.isArray(voids) ? voids : []) {
    if (recRefOf(row)) recVoids.push(row);
    else plainVoids.push(row);
  }
  const explanationList = normalizeExplanations(explanations);
  const plainExplanations = explanationList.filter((row) => isReceiptNumber(row.number));
  const runs = buildRecRuns(recReceipts, recVoids, explanationList);
  const issued = normalizeReceiptEntries(plainReceipts);
  const voidList = normalizeVoidEntries(plainVoids);
  const voidsByNumber = new Map(voidList.map((row) => [row.number, row]));
  const explanationsByNumber = new Map(plainExplanations.map((row) => [row.number, row]));
  const issuedNumbers = new Set(issued.map((row) => row.number));
  const allNumbers = [...issuedNumbers, ...voidList.map((row) => row.number)];
  if (allNumbers.length === 0) {
    return {
      range: null,
      issued,
      gaps: [],
      summary: { issued: 0, voided: 0, explained: 0, unexplained: 0, total: 0 },
      runs,
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
  return { range: { from, to }, issued, gaps, summary, runs };
}

/**
 * Builds one stored-REC- run audit. The run's range spans only its
 * integer tails; every integer tail inside the range that is not
 * issued is a gap carrying the full reference, with exactly one
 * status (voided beats explained beats unexplained, as in the plain
 * run). Non-numeric tails are listed in `issued` and never
 * gap-checked; a voided non-numeric tail is carried in `voids` so
 * it stays visible. With no integer tails at all the run audits as
 * issued-only (range null), never gap-filled.
 */
function buildRecRunAudit(runKey, { receipts = [], voids = [], explanations = [] } = {}) {
  const issued = receipts.filter((row) => row.runKey === runKey);
  const voidList = voids.filter((row) => row.runKey === runKey);
  const explanationList = explanations.filter((row) => row.ref && row.runKey === runKey);
  const yymm = runKey.slice(0, 4);
  const customer = runKey.slice(5);
  const voidsByTail = new Map();
  for (const row of voidList) {
    if (row.tailNumber !== null && !voidsByTail.has(row.tailNumber)) voidsByTail.set(row.tailNumber, row);
  }
  const explanationsByTail = new Map();
  for (const row of explanationList) {
    const parsed = parseReceiptReference(row.ref);
    if (parsed && parsed.tailNumber !== null && !explanationsByTail.has(parsed.tailNumber)) {
      explanationsByTail.set(parsed.tailNumber, row);
    }
  }
  const issuedTailNumbers = new Set(issued.filter((row) => row.tailNumber !== null).map((row) => row.tailNumber));
  const integerTails = [...new Set([...issuedTailNumbers, ...voidsByTail.keys()])];
  if (integerTails.length === 0) {
    return {
      runKey,
      yymm,
      customer,
      range: null,
      issued,
      voids: voidList,
      gaps: [],
      summary: { issued: issued.length, voided: 0, explained: 0, unexplained: 0, total: 0 },
    };
  }
  const from = Math.min(...integerTails);
  const to = Math.max(...integerTails);
  const gaps = [];
  for (let tail = from; tail <= to; tail += 1) {
    if (issuedTailNumbers.has(tail)) continue;
    const ref = `REC-${yymm}-${customer}-${String(tail).padStart(4, '0')}`;
    const voidRow = voidsByTail.get(tail);
    if (voidRow) {
      gaps.push({
        number: ref,
        ref,
        tail,
        runKey,
        status: 'voided',
        voidReason: voidRow.reason,
        voidDate: voidRow.date,
        note: '',
        by: '',
      });
      continue;
    }
    const explanation = explanationsByTail.get(tail);
    if (explanation) {
      gaps.push({
        number: ref,
        ref,
        tail,
        runKey,
        status: 'explained',
        voidReason: '',
        voidDate: '',
        note: explanation.note,
        by: explanation.by,
      });
      continue;
    }
    gaps.push({
      number: ref,
      ref,
      tail,
      runKey,
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
  return { runKey, yymm, customer, range: { from, to }, issued, voids: voidList, gaps, summary };
}

/** Groups stored-REC- rows by run key and audits each run. */
function buildRecRuns(receipts, voids, explanations) {
  const byKey = new Map();
  const add = (rows, kind) => {
    for (const row of rows) {
      if (!byKey.has(row.runKey)) byKey.set(row.runKey, { receipts: [], voids: [] });
      byKey.get(row.runKey)[kind].push(row);
    }
  };
  add(normalizeRecReceiptEntries(receipts), 'receipts');
  add(normalizeRecVoidEntries(voids), 'voids');
  return [...byKey.keys()].sort().map((runKey) => buildRecRunAudit(runKey, { ...byKey.get(runKey), explanations }));
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
  if (!audit || !audit.range) {
    if (audit && audit.runKey) {
      return `REC-${audit.runKey}: ${audit.summary.issued} issued, no numbered run — non-numeric tails only.`;
    }
    return 'No numbered receipts found — nothing to audit.';
  }
  const { from, to } = audit.range;
  const { issued, voided, explained, unexplained } = audit.summary;
  if (audit.runKey) {
    return `REC-${audit.runKey}: tails ${from}–${to}: ${issued} issued, ${voided} voided, ${explained} explained, ${unexplained} unexplained gap${unexplained === 1 ? '' : 's'}.`;
  }
  return `Numbers ${from}–${to}: ${issued} issued, ${voided} voided, ${explained} explained, ${unexplained} unexplained gap${unexplained === 1 ? '' : 's'}.`;
}

/**
 * Records (or replaces) an explanation for a gap number or a REC-
 * reference. Returns a new list; the input list is never mutated.
 * An explanation without a number or a note leaves the list
 * unchanged.
 */
export function explainGap(explanations, value) {
  const list = normalizeExplanations(explanations);
  const row = normalizeExplanation(value);
  if (!row) return list;
  const sameKey = (a, b) => (a.ref && b.ref ? a.ref === b.ref : a.number === b.number);
  return [...list.filter((entry) => !sameKey(entry, row)), row].sort(byExplanationKey);
}

/** Removes the explanation for a number or a REC- reference, returning a new list. */
export function removeExplanation(explanations, key) {
  const list = normalizeExplanations(explanations);
  if (isReceiptNumber(key)) return list.filter((entry) => entry.number !== key);
  const parsed = parseReceiptReference(key);
  if (!parsed) return list;
  return list.filter((entry) => entry.ref !== parsed.ref);
}

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

/** HTML table of the gaps, or a plain note when there are none. */
export function gapAuditHtml(audit) {
  if (!audit || (!audit.range && !audit.runKey)) return '<p class="phase3-note">No numbered receipts found — nothing to audit.</p>';
  if (audit.runKey) {
    const gapRows = audit.gaps.map((gap) => {
      const detail = gap.status === 'voided'
        ? `Void: ${escapeHtml(gap.voidReason)}${gap.voidDate ? ` (${escapeHtml(gap.voidDate)})` : ''}`
        : gap.status === 'explained'
          ? `Note: ${escapeHtml(gap.note)}${gap.by ? ` — ${escapeHtml(gap.by)}` : ''}`
          : 'No void record, no note yet';
      return `<tr><td>${escapeHtml(gap.number)}</td><td>${escapeHtml(receiptGapStatusLabel(gap.status))}</td><td>${detail}</td></tr>`;
    }).join('');
    // A voided reference whose tail is not a number has no place in
    // the integer range, but it is a real void record: it is shown
    // alongside the gaps so it never disappears.
    const outsideVoids = (audit.voids ?? []).filter((row) => row.tailNumber === null).map((row) => `<tr><td>${escapeHtml(row.ref)}</td><td>Voided</td><td>Void: ${escapeHtml(row.reason)}${row.date ? ` (${escapeHtml(row.date)})` : ''}</td></tr>`).join('');
    if (gapRows === '' && outsideVoids === '') {
      if (!audit.range) return `<p class="phase3-note">REC-${audit.runKey}: no numbered run — ${audit.issued.length} issued receipt${audit.issued.length === 1 ? '' : 's'} with non-numeric tails, nothing to gap-check.</p>`;
      return `<p class="phase3-note">REC-${audit.runKey}: tails ${audit.range.from}–${audit.range.to}: no gaps — every number in the run is accounted for.</p>`;
    }
    return `<table class="phase3-table"><thead><tr><th>Number</th><th>Status</th><th>Detail</th></tr></thead><tbody>${gapRows}${outsideVoids}</tbody></table>`;
  }
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
  const rows = audit.issued.map((row) => `<tr><td>${audit.runKey ? escapeHtml(row.ref) : row.number}</td><td>${escapeHtml(row.customer || '—')}</td><td>${escapeHtml(row.date || '—')}</td><td>${escapeHtml(receiptDeliveryStatusLabel(row.deliveryStatus))}</td></tr>`).join('');
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
  if (!audit || !audit.range) {
    if (audit && audit.runKey) return `receipt-gap-audit-${audit.runKey}.csv`;
    return 'receipt-gap-audit.csv';
  }
  if (audit.runKey) return `receipt-gap-audit-${audit.runKey}-${audit.range.from}-${audit.range.to}.csv`;
  return `receipt-gap-audit-${audit.range.from}-${audit.range.to}.csv`;
}
