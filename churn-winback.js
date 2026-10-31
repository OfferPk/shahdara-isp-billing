// SISP-108: Customer Disconnect Reason Analytics & Win-Back Campaign
// Queue. Pure functions only — no DOM, no storage, no billing changes.
//
// WHAT THIS IS (spec verbatim, in two parts):
//  1. When a customer is archived (= disconnected, see hardware-custody.js
//     for the mapping), the archive flow captures a structured
//     `disconnectReason` (one of the four stable keys below) and an
//     explicit owner-chosen `winBackEligible` boolean, plus an optional
//     free-text `disconnectNote`. core.js `archiveCustomer` stamps them;
//     this module owns the vocabulary, the sanitizers and the reads.
//  2. A Win-Back Queue on the dashboard: archived customers whose owner
//     marked them win-back eligible get a 1-tap WhatsApp free-reconnection
//     offer (a wa.me DRAFT built by app.js — nothing ever auto-sends).
//
// HONESTY RULES (pinned by tests):
//  - Customers archived before this feature have NO reason. Analytics
//    count them under "Not recorded" — a reason is never guessed or
//    backfilled, and the stored key '' means exactly that.
//  - Every archive appends one entry to `disconnectHistory`; the
//    top-level fields always mirror the LATEST archive event. Restoring
//    (unarchive) erases nothing — the history stays as the record of
//    past disconnections, and a later re-archive captures a fresh reason.
//  - Analytics are DERIVED live from the archived records on every call;
//    no aggregate counters are ever stored.
//  - The stored reason keys are language-neutral; only their labels go
//    through nav-language t().

import { t } from './nav-language.js';

export const DISCONNECT_REASON_SHIFTED = 'shifted';
export const DISCONNECT_REASON_COMPETITOR = 'competitor';
export const DISCONNECT_REASON_AFFORDABILITY = 'affordability';
export const DISCONNECT_REASON_TEMPORARY_TRAVEL = 'temporary-travel';

// The spec's four structured reasons, in capture order. Never rename a
// key: it is stored on customer records and in backups.
export const DISCONNECT_REASONS = Object.freeze([
  DISCONNECT_REASON_SHIFTED,
  DISCONNECT_REASON_COMPETITOR,
  DISCONNECT_REASON_AFFORDABILITY,
  DISCONNECT_REASON_TEMPORARY_TRAVEL
]);

export const DISCONNECT_REASON_LABEL_KEYS = Object.freeze({
  [DISCONNECT_REASON_SHIFTED]: 'winback_reason_shifted',
  [DISCONNECT_REASON_COMPETITOR]: 'winback_reason_competitor',
  [DISCONNECT_REASON_AFFORDABILITY]: 'winback_reason_affordability',
  [DISCONNECT_REASON_TEMPORARY_TRAVEL]: 'winback_reason_temporary_travel'
});

// '' (or anything unrecognized) is the honest "no reason was recorded".
export const DISCONNECT_REASON_NOT_RECORDED_KEY = 'winback_reason_not_recorded';

export const DISCONNECT_NOTE_MAX_LENGTH = 500;
export const DISCONNECT_HISTORY_LIMIT = 50;

export function isValidDisconnectReason(value) {
  return DISCONNECT_REASONS.includes(value);
}

/** Corrupt / legacy values sanitize to '' = not recorded, never guessed. */
export function sanitizeDisconnectReason(value) {
  return isValidDisconnectReason(value) ? value : '';
}

export function disconnectReasonLabelKey(reason) {
  return DISCONNECT_REASON_LABEL_KEYS[reason] ?? DISCONNECT_REASON_NOT_RECORDED_KEY;
}

export function disconnectReasonLabel(reason, lang = null) {
  return t(disconnectReasonLabelKey(reason), lang);
}

function sanitizeDisconnectNote(value) {
  return typeof value === 'string' ? value.trim().slice(0, DISCONNECT_NOTE_MAX_LENGTH) : '';
}

// Stored datetimes use core's localDateTimeValue shape
// "YYYY-MM-DDTHH:MM" (seconds tolerated). Anything else is not a
// timestamp this module will vouch for.
const DATE_TIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/;

export function sanitizeDisconnectDateTime(value) {
  return typeof value === 'string' && DATE_TIME_PATTERN.test(value.trim()) ? value.trim() : null;
}

/**
 * One history entry per archive event. An entry without a plausible
 * archive timestamp cannot be placed in time, so it is dropped — the
 * sanitizer never invents a date for it.
 */
export function sanitizeDisconnectHistoryEntry(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const archivedAt = sanitizeDisconnectDateTime(raw.archivedAt);
  if (!archivedAt) return null;
  return {
    archivedAt,
    disconnectReason: sanitizeDisconnectReason(raw.disconnectReason),
    winBackEligible: raw.winBackEligible === true,
    disconnectNote: sanitizeDisconnectNote(raw.disconnectNote)
  };
}

export function sanitizeDisconnectHistory(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map(entry => sanitizeDisconnectHistoryEntry(entry))
    .filter(Boolean)
    .slice(-DISCONNECT_HISTORY_LIMIT);
}

/** The capture triple, sanitized — the shape archiveCustomer stamps. */
export function sanitizeDisconnectDetails(raw) {
  const source = raw && typeof raw === 'object' ? raw : {};
  return {
    disconnectReason: sanitizeDisconnectReason(source.disconnectReason),
    winBackEligible: source.winBackEligible === true,
    disconnectNote: sanitizeDisconnectNote(source.disconnectNote)
  };
}

/**
 * Safe read of a customer's disconnect record: legacy records (archived
 * before SISP-108, or never archived) read as reason '' / not eligible /
 * empty history — absence is reported, never filled in.
 */
export function disconnectDetailsOf(customer) {
  const source = customer && typeof customer === 'object' ? customer : {};
  return {
    ...sanitizeDisconnectDetails(source),
    disconnectHistory: sanitizeDisconnectHistory(source.disconnectHistory),
    winBackOfferSentAt: sanitizeDisconnectDateTime(source.winBackOfferSentAt),
    hasRecordedReason: isValidDisconnectReason(source.disconnectReason)
  };
}

/**
 * The archive dialog's default for the win-back checkbox: a customer who
 * left for temporary travel is the natural win-back candidate, so that
 * reason pre-checks the box. It is only a DEFAULT — the owner can flip
 * the checkbox either way before confirming, and the stored value is
 * exactly what the owner left it as.
 */
export function defaultWinBackEligible(reason) {
  return reason === DISCONNECT_REASON_TEMPORARY_TRAVEL;
}

/** The free-reconnection offer text (the app's wording, via i18n). */
export function buildWinBackOfferText(customer, lang = null) {
  const name = String(customer?.name ?? '').trim() || 'Customer';
  return t('winback_offer_msg', lang, { name });
}

/**
 * The Win-Back Queue, derived live: currently-archived customers the
 * owner marked eligible AND who carry a recorded reason. Restoring a
 * customer removes them automatically (they are no longer archived);
 * sending an offer only stamps winBackOfferSentAt — the customer stays
 * listed until they actually reconnect. Newest disconnect first.
 */
export function buildWinBackQueue(state, lang = null) {
  const customers = Array.isArray(state?.customers) ? state.customers : [];
  return customers
    .filter(customer => customer && customer.archived === true)
    .map(customer => ({ customer, details: disconnectDetailsOf(customer) }))
    .filter(({ details }) => details.winBackEligible && details.hasRecordedReason)
    .map(({ customer, details }) => ({
      customerId: customer.id,
      customerNumber: customer.customerNumber ?? null,
      customerName: String(customer.name ?? ''),
      phone: String(customer.phone ?? '').trim(),
      hasPhone: String(customer.phone ?? '').trim() !== '',
      mohalla: String(customer.mohalla ?? ''),
      disconnectReason: details.disconnectReason,
      reasonLabel: disconnectReasonLabel(details.disconnectReason, lang),
      disconnectNote: details.disconnectNote,
      archivedAt: typeof customer.archivedAt === 'string' ? customer.archivedAt : null,
      winBackOfferSentAt: details.winBackOfferSentAt,
      offerText: buildWinBackOfferText(customer, lang)
    }))
    .sort((a, b) => String(b.archivedAt ?? '').localeCompare(String(a.archivedAt ?? '')) || (a.customerNumber ?? 0) - (b.customerNumber ?? 0));
}

function referenceMonthKey(referenceDate) {
  const date = referenceDate instanceof Date && !Number.isNaN(referenceDate.getTime()) ? referenceDate : new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Disconnect analytics, derived live from the archived records: counts
 * per reason for all time and for the reference month (by archivedAt),
 * with reason-less legacy archives counted honestly as not recorded.
 * Nothing here is stored — call it fresh on every render.
 */
export function buildDisconnectAnalytics(state, referenceDate = new Date()) {
  const customers = Array.isArray(state?.customers) ? state.customers : [];
  const month = referenceMonthKey(referenceDate);
  const byReason = DISCONNECT_REASONS.map(reason => ({ reason, labelKey: DISCONNECT_REASON_LABEL_KEYS[reason], allTime: 0, thisMonth: 0 }));
  const byReasonIndex = new Map(byReason.map((row, index) => [row.reason, index]));
  let totalArchived = 0;
  let recordedCount = 0;
  let notRecordedAllTime = 0;
  let notRecordedThisMonth = 0;
  let winBackEligibleCount = 0;
  let winBackOfferedCount = 0;
  for (const customer of customers) {
    if (!customer || customer.archived !== true) continue;
    totalArchived++;
    const details = disconnectDetailsOf(customer);
    const archivedMonth = typeof customer.archivedAt === 'string' ? customer.archivedAt.slice(0, 7) : '';
    const isThisMonth = archivedMonth === month;
    if (details.hasRecordedReason) {
      recordedCount++;
      const row = byReason[byReasonIndex.get(details.disconnectReason)];
      row.allTime++;
      if (isThisMonth) row.thisMonth++;
    } else {
      notRecordedAllTime++;
      if (isThisMonth) notRecordedThisMonth++;
    }
    if (details.winBackEligible && details.hasRecordedReason) {
      winBackEligibleCount++;
      if (details.winBackOfferSentAt) winBackOfferedCount++;
    }
  }
  return {
    month,
    totalArchived,
    recordedCount,
    notRecorded: { allTime: notRecordedAllTime, thisMonth: notRecordedThisMonth },
    winBackEligibleCount,
    winBackOfferedCount,
    byReason
  };
}
