// Plan 58 (Plan 1-100) — Save conversation and retention offer record.
//
// When a customer says they want to leave, the conversation and any
// offer made to keep them lives only in the operator's memory, so
// nobody learns which offers actually save customers and which are
// wasted. This module is the RECORD for that conversation: date,
// reason for leaving (Plan 57's six reasons, mirrored here so the
// module stays import-free), the one offer made, and the one
// outcome — accepted and stayed, declined and left, or still
// deciding — plus, for an accepted offer, the link to the change
// that fulfilled it.
//
// Scope fence, stated plainly against the neighbouring systems:
//   - This plan grants no discount, pause, or billing change of its
//     own. The offer itself is always applied through its existing
//     path — package change with preview (Plan 46), extension
//     (Plan 38), repayment plan (Plan 37), or a hold — and this
//     record only ever points at that change, never performs it.
//   - It neither reads nor writes Plan 57's exit-reason store: a
//     save conversation may carry the customer's exit reason, but
//     recording it here never creates, replaces, or alters an exit
//     record, and it never reopens, bills, or alters the customer
//     record, any bill, any payment, or any package. The module
//     holds no bill, payment, package, or lifecycle field, so
//     there is nothing here that could rewrite one.
//   - It is import-free: the caller supplies every record and the
//     module never reads storage, the clock, or the network, and
//     never mutates an input.
//
// How the fence is kept in this module:
//   - A conversation without an id, without a customer, with an
//     offer outside the five in the plan, or with an outcome
//     outside the three in the plan, is not a record:
//     normalisation returns null instead of inventing one.
//   - An impossible date (2026-02-30) is refused outright, never
//     stored as a neighbouring date; a blank date stays null,
//     never guessed.
//   - An accepted offer must link to the change that fulfilled it:
//     an accepted_stayed record with no fulfilling-change link is
//     refused outright, because an acceptance with nothing behind
//     it is exactly the unverifiable claim this record exists to
//     prevent. A declined or still-deciding record needs no link.
//   - A blank exit reason stays null, never a guessed cause, and
//     a reason outside Plan 57's six is refused outright.
//   - One conversation is one record: upsert replaces by id, so a
//     customer may have several conversations over time, but no
//     single conversation can ever carry two offers or two
//     outcomes.

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const SAVE_OFFERS = [
  'package_change',
  'pause_hold',
  'extension',
  'repayment_plan',
  'other',
];

export const SAVE_OFFER_LABELS = {
  package_change: 'Package change',
  pause_hold: 'Pause / hold',
  extension: 'Bill extension',
  repayment_plan: 'Repayment plan',
  other: 'Other offer',
};

export const SAVE_OUTCOMES = [
  'accepted_stayed',
  'declined_left',
  'still_deciding',
];

export const SAVE_OUTCOME_LABELS = {
  accepted_stayed: 'Accepted and stayed',
  declined_left: 'Declined and left',
  still_deciding: 'Still deciding',
};

// Plan 57's six exit reasons, mirrored so this module stays
// import-free. A save conversation may carry one of these, or none.
export const SAVE_EXIT_REASONS = [
  'price',
  'competitor',
  'repeated_faults',
  'moving_house',
  'service_quality',
  'other',
];

export const SAVE_EXIT_REASON_LABELS = {
  price: 'Price too high',
  competitor: 'Competitor offer',
  repeated_faults: 'Repeated faults',
  moving_house: 'Moving house',
  service_quality: 'Service quality',
  other: 'Other',
};

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function csvCell(value) {
  const cell = String(value ?? '');
  return /[",\n]/.test(cell) ? `"${cell.replaceAll('"', '""')}"` : cell;
}

export function validSaveDate(value) {
  const clean = text(value);
  if (!DATE_RE.test(clean)) return null;
  const [year, month, day] = clean.split('-').map(Number);
  const built = new Date(Date.UTC(year, month - 1, day));
  if (built.getUTCFullYear() !== year || built.getUTCMonth() !== month - 1 || built.getUTCDate() !== day) return null;
  return clean;
}

export function normalizeSaveConversation(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = text(raw.id);
  if (!id) return null;
  const customerId = text(raw.customerId);
  if (!customerId) return null;
  const offer = text(raw.offer);
  if (!SAVE_OFFERS.includes(offer)) return null;
  const outcome = text(raw.outcome);
  if (!SAVE_OUTCOMES.includes(outcome)) return null;
  let conversationDate = null;
  if (raw.conversationDate !== undefined && raw.conversationDate !== null && text(raw.conversationDate) !== '') {
    conversationDate = validSaveDate(raw.conversationDate);
    if (!conversationDate) return null;
  }
  let exitReason = null;
  if (raw.exitReason !== undefined && raw.exitReason !== null && text(raw.exitReason) !== '') {
    exitReason = text(raw.exitReason);
    if (!SAVE_EXIT_REASONS.includes(exitReason)) return null;
  }
  const fulfilledChangeLink = text(raw.fulfilledChangeLink);
  if (outcome === 'accepted_stayed' && !fulfilledChangeLink) return null;
  return {
    id,
    customerId,
    customerName: text(raw.customerName),
    conversationDate,
    exitReason,
    offer,
    outcome,
    fulfilledChangeLink: fulfilledChangeLink || null,
    note: text(raw.note),
  };
}

export function normalizeSaveConversationList(list) {
  if (!Array.isArray(list)) return [];
  const byId = new Map();
  for (const raw of list) {
    const record = normalizeSaveConversation(raw);
    if (record) byId.set(record.id, record);
  }
  return [...byId.values()];
}

export function findSaveConversation(list, id) {
  const clean = text(id);
  if (!clean) return null;
  return normalizeSaveConversationList(list).find((record) => record.id === clean) ?? null;
}

export function upsertSaveConversation(list, raw) {
  const record = normalizeSaveConversation(raw);
  if (!record) return normalizeSaveConversationList(list);
  const clean = normalizeSaveConversationList(list).filter((item) => item.id !== record.id);
  clean.push(record);
  return clean;
}

export function removeSaveConversation(list, id) {
  const clean = text(id);
  if (!clean) return normalizeSaveConversationList(list);
  return normalizeSaveConversationList(list).filter((record) => record.id !== clean);
}

export function filterSaveConversations(list, filters) {
  const clean = normalizeSaveConversationList(list);
  const offer = filters && text(filters.offer);
  const outcome = filters && text(filters.outcome);
  return clean.filter((record) => {
    if (offer && offer !== 'all' && record.offer !== offer) return false;
    if (outcome && outcome !== 'all' && record.outcome !== outcome) return false;
    return true;
  });
}

export function sortedSaveConversations(list) {
  const clean = normalizeSaveConversationList(list);
  return [...clean].sort((a, b) => {
    if (a.conversationDate && b.conversationDate && a.conversationDate !== b.conversationDate) {
      return b.conversationDate.localeCompare(a.conversationDate);
    }
    if (a.conversationDate && !b.conversationDate) return -1;
    if (!a.conversationDate && b.conversationDate) return 1;
    const nameCmp = (a.customerName || a.customerId).localeCompare(b.customerName || b.customerId);
    if (nameCmp !== 0) return nameCmp;
    return a.id.localeCompare(b.id);
  });
}

export function buildSaveSummary(list) {
  const clean = normalizeSaveConversationList(list);
  const byOffer = {};
  for (const offer of SAVE_OFFERS) byOffer[offer] = 0;
  const byOutcome = {};
  for (const outcome of SAVE_OUTCOMES) byOutcome[outcome] = 0;
  for (const record of clean) {
    byOffer[record.offer] += 1;
    byOutcome[record.outcome] += 1;
  }
  return {
    total: clean.length,
    byOffer,
    byOutcome,
    saved: byOutcome.accepted_stayed,
    lost: byOutcome.declined_left,
    deciding: byOutcome.still_deciding,
  };
}

export function saveSummaryText(summary) {
  if (!summary || typeof summary !== 'object') return 'No save conversations recorded.';
  if (summary.total === 0) return 'No save conversations recorded.';
  return `${summary.total} save conversation(s): ${summary.saved} accepted and stayed, ${summary.lost} declined and left, ${summary.deciding} still deciding.`;
}

export function saveHtml(list) {
  const rows = sortedSaveConversations(list);
  if (rows.length === 0) return '<p style="font-size: 12px;">No save conversations recorded.</p>';
  const body = rows.map((record) => `<tr><td>${escapeHtml(record.customerName || record.customerId)}</td><td>${escapeHtml(record.conversationDate || 'Not recorded')}</td><td>${escapeHtml(record.exitReason ? (SAVE_EXIT_REASON_LABELS[record.exitReason] || record.exitReason) : 'Not recorded')}</td><td>${escapeHtml(SAVE_OFFER_LABELS[record.offer] || record.offer)}</td><td>${escapeHtml(SAVE_OUTCOME_LABELS[record.outcome] || record.outcome)}</td><td>${escapeHtml(record.fulfilledChangeLink || '—')}</td><td>${escapeHtml(record.note || '—')}</td></tr>`).join('');
  return `<table><thead><tr><th>Customer</th><th>Date</th><th>Reason for leaving</th><th>Offer</th><th>Outcome</th><th>Fulfilling change</th><th>Note</th></tr></thead><tbody>${body}</tbody></table>`;
}

export function saveCsv(list) {
  const rows = sortedSaveConversations(list);
  const lines = ['id,customer,date,exit_reason,offer,outcome,fulfilling_change,note'];
  for (const record of rows) {
    lines.push([
      record.id,
      record.customerName || record.customerId,
      record.conversationDate || '',
      record.exitReason ? (SAVE_EXIT_REASON_LABELS[record.exitReason] || record.exitReason) : '',
      SAVE_OFFER_LABELS[record.offer] || record.offer,
      SAVE_OUTCOME_LABELS[record.outcome] || record.outcome,
      record.fulfilledChangeLink || '',
      record.note || '',
    ].map(csvCell).join(','));
  }
  return lines.join('\n');
}

export function saveFilename() {
  return 'save-conversations.csv';
}
