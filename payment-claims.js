// Plan 63 (Plan 1-100) — "I already paid" payment-claim check workflow.
//
// A customer says they already paid but no matching payment is found
// at once, so the operator searches ad hoc and risks recording a
// duplicate or missing a wallet entry. This module is the written
// claim check: one claim record per "I already paid" report, with
// the date claimed, the amount, the channel, and the TID or receipt
// reference the customer showed, plus exactly one check outcome —
// matched to an existing payment, matched to a suspense item, or
// not found.
//
// The fences, stated plainly:
//   - Matching itself is unchanged (Plan V): this module never
//     matches anything on its own. The operator records the check
//     result; the module only stores it.
//   - Suspense claiming is unchanged (Plan O): a claim matched to a
//     suspense item only carries that item's id as a link. It never
//     claims, moves, or alters the suspense item itself.
//   - A claim never creates a payment. The module holds no payment
//     row, no suspense row, and no bill field — only the link id
//     the operator typed, so recording a claim can never create or
//     alter any payment record.
//   - A not-found claim stays visible with a follow-up note until
//     the operator closes it with a reason. Closing a not-found
//     claim without a reason is refused outright.
//
// Dates are strict YYYY-MM-DD calendar dates (2026-02-30 is not a
// date). Amounts are summed in integer cents, so no float drift.
// Inputs are never mutated, and the module never reads storage,
// the clock, or the network. Mohalla filtering mirrors the Plan T
// canonical rule as the other pure modules do: a leading "Mohalla"
// is stripped, matching is case-insensitive, and the aliases
// bani -> BANII, kishti -> KISHTII, chamyaa -> CHAMYAAA apply;
// anything else keeps its own label, never rewritten.

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export const CLAIM_CHANNELS = [
  'cash',
  'easypaisa',
  'jazzcash',
  'bank_transfer',
  'other',
];

export const CLAIM_CHANNEL_LABELS = {
  cash: 'Cash',
  easypaisa: 'Easypaisa',
  jazzcash: 'JazzCash',
  bank_transfer: 'Bank transfer',
  other: 'Other',
};

export const CLAIM_OUTCOMES = [
  'pending',
  'matched_payment',
  'matched_suspense',
  'not_found',
];

export const CLAIM_OUTCOME_LABELS = {
  pending: 'Not checked yet',
  matched_payment: 'Matched to an existing payment',
  matched_suspense: 'Matched to a suspense item',
  not_found: 'Not found',
};

const MOHALLA_ALIASES = {
  bani: 'BANII',
  kishti: 'KISHTII',
  chamyaa: 'CHAMYAAA',
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

function toCents(amount) {
  if (typeof amount === 'boolean' || amount === null || amount === undefined) return null;
  const num = Number(amount);
  if (!Number.isFinite(num) || num <= 0) return null;
  return Math.round(num * 100);
}

function fromCents(cents) {
  return cents / 100;
}

// A strict YYYY-MM-DD calendar date, or null. A datetime string
// contributes only its date part; anything else is not a date.
export function validClaimDate(value) {
  const raw = text(value);
  if (!raw) return null;
  const datePart = raw.slice(0, 10);
  if (!DATE_RE.test(datePart)) return null;
  const [year, month, day] = datePart.split('-').map(Number);
  const built = new Date(Date.UTC(year, month - 1, day));
  if (built.getUTCFullYear() !== year || built.getUTCMonth() !== month - 1 || built.getUTCDate() !== day) return null;
  return datePart;
}

// Canonical mohalla key for filtering, same rule as Plan 61.
export function claimMohallaKey(value) {
  const raw = text(value);
  if (!raw) return null;
  const stripped = raw.replace(/^mohalla\s+/i, '').trim();
  if (!stripped) return null;
  const folded = stripped.toLowerCase().replace(/\s+/g, ' ');
  const aliased = MOHALLA_ALIASES[folded.replace(/\s+/g, '')] ?? MOHALLA_ALIASES[folded];
  if (aliased) return aliased;
  return stripped.toUpperCase();
}

function claimMohallaLabel(value) {
  const raw = text(value);
  if (!raw) return '';
  return raw.replace(/^mohalla\s+/i, '').trim();
}

// One normalised claim, or null when the record is half-formed.
// Every claim carries a channel, a reference, and exactly one
// outcome. A matched claim without a link id is half-formed: it
// is refused, never stored as "matched" to nothing. A closed
// not-found claim without a close reason is likewise refused.
export function normalizePaymentClaim(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = text(raw.id);
  const customerId = text(raw.customerId);
  const reference = text(raw.reference);
  const channel = text(raw.channel);
  const cents = toCents(raw.amount);
  if (!id || !customerId || !reference || !CLAIM_CHANNELS.includes(channel) || cents === null) return null;
  const outcome = text(raw.outcome) || 'pending';
  if (!CLAIM_OUTCOMES.includes(outcome)) return null;
  const linkedId = text(raw.linkedId);
  if ((outcome === 'matched_payment' || outcome === 'matched_suspense') && !linkedId) return null;
  const closed = raw.closed === true;
  const closeReason = text(raw.closeReason);
  if (closed && outcome === 'not_found' && !closeReason) return null;
  const dateClaimed = raw.dateClaimed === undefined || raw.dateClaimed === null || raw.dateClaimed === ''
    ? null
    : validClaimDate(raw.dateClaimed);
  if (raw.dateClaimed !== undefined && raw.dateClaimed !== null && raw.dateClaimed !== '' && dateClaimed === null) return null;
  return {
    id,
    customerId,
    customerName: text(raw.customerName),
    dateClaimed,
    amount: fromCents(cents),
    amountCents: cents,
    channel,
    reference,
    outcome,
    linkedId: linkedId || '',
    followUpNote: text(raw.followUpNote),
    closed,
    closeReason: closed ? closeReason : '',
    mohalla: text(raw.mohalla),
  };
}

export function normalizePaymentClaimList(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const entry of list) {
    const claim = normalizePaymentClaim(entry);
    if (claim) out.push(claim);
  }
  return out;
}

export function upsertPaymentClaim(list, claim) {
  const clean = normalizePaymentClaim(claim);
  const base = normalizePaymentClaimList(list);
  if (!clean) return base;
  const next = base.filter((entry) => entry.id !== clean.id);
  next.push(clean);
  return next;
}

export function removePaymentClaim(list, id) {
  return normalizePaymentClaimList(list).filter((entry) => entry.id !== text(id));
}

export function findPaymentClaim(list, id) {
  return normalizePaymentClaimList(list).find((entry) => entry.id === text(id)) ?? null;
}

// Record a check outcome. A matched outcome needs its link id;
// a not-found outcome keeps the claim open with its follow-up
// note. Recording an outcome never touches a payment record —
// the link is only a stored id, never a payment row.
export function setClaimOutcome(list, id, outcome, linkedId = '', followUpNote = '') {
  const base = normalizePaymentClaimList(list);
  if (!CLAIM_OUTCOMES.includes(text(outcome))) return base;
  const target = text(outcome);
  const link = text(linkedId);
  if ((target === 'matched_payment' || target === 'matched_suspense') && !link) return base;
  return base.map((entry) => {
    if (entry.id !== text(id)) return entry;
    if (entry.closed) return entry;
    return {
      ...entry,
      outcome: target,
      linkedId: (target === 'matched_payment' || target === 'matched_suspense') ? link : '',
      followUpNote: target === 'not_found' ? (text(followUpNote) || entry.followUpNote) : entry.followUpNote,
    };
  });
}

// Close a claim. A not-found claim closes only with a reason, so
// it can never be quietly dropped while still unanswered. Closing
// never creates, moves, or alters any payment record.
export function closePaymentClaim(list, id, reason = '') {
  const base = normalizePaymentClaimList(list);
  const entry = base.find((item) => item.id === text(id));
  if (!entry || entry.closed) return base;
  if (entry.outcome === 'not_found' && !text(reason)) return base;
  return base.map((item) => (item.id === text(id)
    ? { ...item, closed: true, closeReason: text(reason) }
    : item));
}

export function reopenPaymentClaim(list, id) {
  const base = normalizePaymentClaimList(list);
  return base.map((item) => (item.id === text(id)
    ? { ...item, closed: false, closeReason: '' }
    : item));
}

// Open claims only (closed claims are history), oldest claimed
// first, undated last, then id A–Z. Filterable by outcome,
// channel, and mohalla (Plan T canonical rule, plus the
// __unassigned__ filter for no-mohalla claims).
export function openPaymentClaims(list, filters = {}) {
  const base = normalizePaymentClaimList(list).filter((entry) => !entry.closed);
  const outcome = text(filters.outcome);
  const channel = text(filters.channel);
  const mohalla = text(filters.mohalla);
  const mohallaKey = mohalla === '__unassigned__' ? '__unassigned__' : claimMohallaKey(mohalla);
  const filtered = base.filter((entry) => {
    if (outcome && entry.outcome !== outcome) return false;
    if (channel && entry.channel !== channel) return false;
    if (mohallaKey) {
      if (mohallaKey === '__unassigned__') {
        if (claimMohallaKey(entry.mohalla)) return false;
      } else if (claimMohallaKey(entry.mohalla) !== mohallaKey) return false;
    }
    return true;
  });
  return filtered.sort((a, b) => {
    if (a.dateClaimed && b.dateClaimed && a.dateClaimed !== b.dateClaimed) return a.dateClaimed < b.dateClaimed ? -1 : 1;
    if (a.dateClaimed && !b.dateClaimed) return -1;
    if (!a.dateClaimed && b.dateClaimed) return 1;
    return a.id.localeCompare(b.id);
  });
}

export function buildClaimSummary(list) {
  const base = normalizePaymentClaimList(list);
  const byOutcome = {};
  for (const outcome of CLAIM_OUTCOMES) byOutcome[outcome] = { count: 0, cents: 0 };
  let totalCents = 0;
  let openCents = 0;
  let openCount = 0;
  for (const entry of base) {
    byOutcome[entry.outcome].count += 1;
    byOutcome[entry.outcome].cents += entry.amountCents;
    totalCents += entry.amountCents;
    if (!entry.closed) {
      openCount += 1;
      openCents += entry.amountCents;
    }
  }
  return {
    total: base.length,
    openCount,
    closedCount: base.length - openCount,
    totalAmount: fromCents(totalCents),
    openAmount: fromCents(openCents),
    byOutcome: Object.fromEntries(Object.entries(byOutcome).map(([key, value]) => [key, { ...value, amount: fromCents(value.cents) }])),
  };
}

export function claimSummaryText(summary) {
  if (!summary || summary.total === 0) return 'No payment claims recorded yet.';
  const parts = CLAIM_OUTCOMES
    .filter((outcome) => summary.byOutcome[outcome].count > 0)
    .map((outcome) => `${summary.byOutcome[outcome].count} ${CLAIM_OUTCOME_LABELS[outcome].toLowerCase()} (Rs. ${summary.byOutcome[outcome].amount})`);
  return `${summary.total} claim${summary.total === 1 ? '' : 's'} totalling Rs. ${summary.totalAmount}; ${summary.openCount} still open (Rs. ${summary.openAmount}). ${parts.join('; ')}.`;
}

export function claimHtml(claims) {
  const rows = normalizePaymentClaimList(claims);
  if (rows.length === 0) return '<p class="empty-note">No claims in this view.</p>';
  const body = rows.map((entry) => {
    const link = entry.linkedId
      ? `Linked: ${escapeHtml(entry.linkedId)}`
      : entry.outcome === 'not_found' && entry.followUpNote
        ? `Follow-up: ${escapeHtml(entry.followUpNote)}`
        : entry.closed && entry.closeReason
          ? `Closed: ${escapeHtml(entry.closeReason)}`
          : '—';
    return `<tr><td>${escapeHtml(entry.id)}</td><td>${escapeHtml(entry.customerName || entry.customerId)}</td><td>${escapeHtml(entry.dateClaimed || '—')}</td><td>Rs. ${escapeHtml(entry.amount)}</td><td>${escapeHtml(CLAIM_CHANNEL_LABELS[entry.channel])}</td><td>${escapeHtml(entry.reference)}</td><td>${escapeHtml(CLAIM_OUTCOME_LABELS[entry.outcome])}</td><td>${escapeHtml(link)}</td><td>${escapeHtml(claimMohallaLabel(entry.mohalla) || '—')}</td></tr>`;
  }).join('');
  return `<table class="data-table"><thead><tr><th>Claim</th><th>Customer</th><th>Date claimed</th><th>Amount</th><th>Channel</th><th>Reference</th><th>Outcome</th><th>Link / follow-up</th><th>Mohalla</th></tr></thead><tbody>${body}</tbody></table>`;
}

export function claimCsv(claims) {
  const rows = normalizePaymentClaimList(claims);
  const header = ['Claim id', 'Customer id', 'Customer', 'Date claimed', 'Amount', 'Channel', 'Reference', 'Outcome', 'Linked id', 'Follow-up note', 'Closed', 'Close reason', 'Mohalla'].join(',');
  const lines = rows.map((entry) => [
    entry.id,
    entry.customerId,
    entry.customerName,
    entry.dateClaimed || '',
    entry.amount,
    CLAIM_CHANNEL_LABELS[entry.channel],
    entry.reference,
    CLAIM_OUTCOME_LABELS[entry.outcome],
    entry.linkedId,
    entry.followUpNote,
    entry.closed ? 'yes' : 'no',
    entry.closeReason,
    claimMohallaLabel(entry.mohalla),
  ].map(csvCell).join(','));
  return [header, ...lines].join('\n');
}

export function claimFilename() {
  const now = new Date();
  const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return `payment-claims-${stamp}.csv`;
}
