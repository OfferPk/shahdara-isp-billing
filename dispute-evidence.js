// Plan 227 (Plan 203-350) — Payment dispute evidence note.
//
// A dispute case (Plans 61-65, with follow-up in Plan 117) can hold
// the claim and the outcome, but the evidence behind it — which
// receipt, slip, or message was checked — is not listed against the
// case. Plan 61's case holds one evidence note of its own (a receipt
// or TID the customer showed), but that is a single note on the case,
// not a list of every item checked. This module adds only the missing
// piece: one evidence note per item checked for a dispute, so a
// dispute is settled from listed evidence the customer can be shown,
// not from one person's recollection of what was checked.
//
// One evidence note: the case reference, the evidence type (receipt,
// slip, message, or ledger entry), the reference of the item checked,
// the date it was checked, and a plain-words finding.
//
// The fences, stated plainly:
//   - The dispute case log (Plan 61), the balance, resolution, and
//     letter modules (Plans 62-65), and the dispute follow-up queue
//     (Plan 117) are neither read nor rewritten here. Case references
//     arrive as caller-supplied text
//     only, and this module holds no case status and no outcome.
//   - Recording a note never changes any bill, payment, receipt, or
//     case history by itself: it lists evidence only, it settles
//     nothing and it changes no case outcome.
//   - A note with no case reference or no reference is refused
//     outright, as is a note with no id, an unknown evidence type,
//     or a non-calendar date checked. Duplicate ids are never
//     rewritten. There is no edit function: only record and remove.
//   - Inputs are never mutated, and the module never reads storage,
//     the clock, the network, or the page.

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export const EVIDENCE_TYPES = ['receipt', 'slip', 'message', 'ledger_entry'];

export const EVIDENCE_TYPE_LABELS = {
  receipt: 'Receipt',
  slip: 'Slip',
  message: 'Message',
  ledger_entry: 'Ledger entry',
};

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function validEvidenceDate(value) {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
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
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeCsv(value) {
  const cell = String(value);
  return /[",\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell;
}

export function normalizeDisputeEvidence(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = text(raw.id);
  const caseRef = text(raw.caseRef);
  const reference = text(raw.reference);
  const evidenceType = text(raw.evidenceType);
  const dateChecked = text(raw.dateChecked);
  if (!id || !caseRef || !reference) return null;
  if (!EVIDENCE_TYPES.includes(evidenceType)) return null;
  if (!validEvidenceDate(dateChecked)) return null;
  return {
    id,
    caseRef,
    evidenceType,
    reference,
    dateChecked,
    finding: text(raw.finding),
  };
}

export function normalizeDisputeEvidenceList(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of list) {
    const note = normalizeDisputeEvidence(raw);
    if (!note || seen.has(note.id)) continue;
    seen.add(note.id);
    out.push(note);
  }
  return out;
}

export function recordDisputeEvidence(list, raw) {
  const clean = normalizeDisputeEvidenceList(list);
  const note = normalizeDisputeEvidence(raw);
  if (!note) return null;
  if (clean.some((item) => item.id === note.id)) return null;
  return [...clean, note];
}

export function removeDisputeEvidence(list, id) {
  const clean = normalizeDisputeEvidenceList(list);
  const wanted = text(id);
  if (!wanted) return clean;
  return clean.filter((item) => item.id !== wanted);
}

export function findDisputeEvidence(list, id) {
  const clean = normalizeDisputeEvidenceList(list);
  const wanted = text(id);
  return clean.find((item) => item.id === wanted) ?? null;
}

export function disputeEvidenceSorted(list) {
  const clean = normalizeDisputeEvidenceList(list);
  return [...clean].sort((a, b) => {
    if (a.dateChecked !== b.dateChecked) return a.dateChecked < b.dateChecked ? -1 : 1;
    if (a.caseRef !== b.caseRef) return a.caseRef < b.caseRef ? -1 : 1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

export function evidenceForCase(list, caseRef) {
  const wanted = text(caseRef);
  if (!wanted) return [];
  return disputeEvidenceSorted(list).filter((item) => item.caseRef === wanted);
}

export function evidenceForType(list, evidenceType) {
  const wanted = text(evidenceType);
  if (!EVIDENCE_TYPES.includes(wanted)) return [];
  return disputeEvidenceSorted(list).filter((item) => item.evidenceType === wanted);
}

// Each open case the caller supplies lists its own evidence notes.
// Case references are caller-supplied text: this module never reads
// the case log itself, so it cannot know which cases are open.
export function evidenceForCases(list, caseRefs) {
  if (!Array.isArray(caseRefs)) return [];
  return caseRefs
    .map((ref) => text(ref))
    .filter((ref) => ref !== '')
    .map((caseRef) => ({ caseRef, notes: evidenceForCase(list, caseRef) }));
}

export function buildDisputeEvidenceSummary(list) {
  const clean = normalizeDisputeEvidenceList(list);
  const byType = {};
  for (const type of EVIDENCE_TYPES) byType[type] = 0;
  const caseRefs = new Set();
  for (const note of clean) {
    byType[note.evidenceType] += 1;
    caseRefs.add(note.caseRef);
  }
  return { total: clean.length, cases: caseRefs.size, byType };
}

export function disputeEvidenceSummaryText(list) {
  const summary = buildDisputeEvidenceSummary(list);
  const parts = EVIDENCE_TYPES.map(
    (type) => `${summary.byType[type]} ${EVIDENCE_TYPE_LABELS[type].toLowerCase()}`,
  );
  return `${summary.total} evidence notes across ${summary.cases} cases (${parts.join(', ')}).`;
}

export function disputeEvidenceNoteText(note) {
  const clean = normalizeDisputeEvidence(note);
  if (!clean) return '';
  const finding = clean.finding === '' ? 'No finding noted.' : clean.finding;
  return `Case ${clean.caseRef} — ${EVIDENCE_TYPE_LABELS[clean.evidenceType]} ${clean.reference} checked on ${clean.dateChecked}: ${finding}`;
}

export function disputeEvidenceEntryHtml(note) {
  const clean = normalizeDisputeEvidence(note);
  if (!clean) return '';
  return `<p>${escapeHtml(disputeEvidenceNoteText(clean))}</p>`;
}

export function disputeEvidenceAllHtml(list) {
  const sorted = disputeEvidenceSorted(list);
  return sorted.map((note) => disputeEvidenceEntryHtml(note)).join('');
}

export function disputeEvidenceCsv(list) {
  const sorted = disputeEvidenceSorted(list);
  const header = 'id,caseRef,evidenceType,reference,dateChecked,finding';
  const rows = sorted.map((note) =>
    [note.id, note.caseRef, note.evidenceType, note.reference, note.dateChecked, note.finding]
      .map(escapeCsv)
      .join(','),
  );
  return [header, ...rows].join('\n');
}

export function disputeEvidenceFilename() {
  return 'dispute-evidence.csv';
}
