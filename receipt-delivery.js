// Plan 5 (Plan 1-100) — Field receipt delivery status.
//
// TRACKING ONLY. This module never changes a receipt's money, a
// payment record, or any VOID rule (Plan Q keeps receipt branding and
// content; the VOID stamp still comes from payment-void-audit.js).
// It answers one question — "did this field receipt actually reach
// the customer, and if not, what is still waiting to be retried?" —
// so Saad does not have to re-issue receipts from memory when a
// message fails.
//
// How it relates to the receipt sharing that already exists
// (nav-quick-profile.js markReceiptShared / isReceiptShared):
//   * That system records a single boolean: the receipt draft was
//     opened (WhatsApp) or copied (clipboard), with a sharedAt time.
//     It has no notion of pending or failed delivery, no retry list,
//     and no per-receipt status a list can be filtered by.
//   * This module supplies exactly those gaps: four statuses, a
//     sent timestamp, attempt/retry counts, a failure note, a
//     retryable list, and a summary. deliveryFromSharedRecord
//     bridges the two: an existing shared record becomes a Plan 5
//     entry with status 'sent' and sentAt = sharedAt, so nothing
//     already recorded is lost or re-derived.
//   * Delivery status lives beside the payment/receipt, never inside
//     it: withReceiptDelivery returns a COPY carrying the entry and
//     leaves the original payment object untouched (amount, method,
//     date and every other field byte-identical).
//
// The module is import-free by design (like route-sequencing.js,
// visit-outcomes.js, day-target.js and denomination-count.js), so
// nav-quick-collect.js can use it without pulling in the app graph.
// It never mutates its inputs, never reads the clock or storage,
// and never touches the network: the caller passes every timestamp
// explicitly, so a "sent" entry always carries a real time supplied
// by the caller, never an invented one.
//
// Statuses (exactly the plan's catalogue):
//   generated — receipt created in the field, delivery not yet
//     attempted or queued. This is the status every new field
//     receipt starts with.
//   pending   — delivery queued or awaiting a retry. A receipt
//     becomes pending when it is first queued (from generated) or
//     when a failed/pending receipt is retried.
//   sent      — delivery confirmed, and sentAt carries the time it
//     was sent. Sent is final: a sent entry cannot go back to
//     pending or failed.
//   failed    — the last delivery attempt failed. The failure note
//     (if any) is kept so the operator can see why, and the entry
//     stays on the retry list until it is retried or sent.
// Transitions that do not make sense (for example, failing a sent
// receipt, or retrying a generated one) return the entry unchanged
// instead of inventing a state.

export const RECEIPT_DELIVERY_STATUSES = Object.freeze([
  'generated',
  'sent',
  'pending',
  'failed',
]);

export const RECEIPT_DELIVERY_STATUS_LABELS = Object.freeze({
  generated: 'Generated',
  sent: 'Sent',
  pending: 'Pending',
  failed: 'Failed',
});

const text = (value) => (typeof value === 'string' ? value.trim() : '');
const validTime = (value) => {
  const time = text(value);
  return time ? time : null;
};
const isRecord = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

/** True when the value is one of the four delivery statuses. */
export function isReceiptDeliveryStatus(value) {
  return RECEIPT_DELIVERY_STATUSES.includes(value);
}

/** Human label for a status; unknown values read as 'Generated'. */
export function receiptDeliveryStatusLabel(status) {
  return RECEIPT_DELIVERY_STATUS_LABELS[status] || RECEIPT_DELIVERY_STATUS_LABELS.generated;
}

/**
 * Normalises any stored delivery entry to exactly one valid status
 * plus the full field set. Unknown or missing statuses become
 * 'generated'; a sentAt time is kept only on a 'sent' entry, so a
 * pending/failed/generated entry can never claim a sent time.
 * Never mutates its input; non-records become a fresh 'generated'
 * entry with empty references.
 */
export function normalizeReceiptDelivery(entry) {
  if (!isRecord(entry)) {
    return {
      receiptRef: '',
      paymentId: '',
      channel: '',
      status: 'generated',
      sentAt: null,
      attempts: 0,
      retries: 0,
      lastFailure: '',
      lastAttemptAt: null,
    };
  }
  const status = isReceiptDeliveryStatus(entry.status) ? entry.status : 'generated';
  const attempts = Number.isFinite(Number(entry.attempts)) && Number(entry.attempts) > 0
    ? Math.floor(Number(entry.attempts)) : 0;
  const retries = Number.isFinite(Number(entry.retries)) && Number(entry.retries) > 0
    ? Math.floor(Number(entry.retries)) : 0;
  return {
    receiptRef: text(entry.receiptRef),
    paymentId: text(entry.paymentId),
    channel: text(entry.channel),
    status,
    sentAt: status === 'sent' ? validTime(entry.sentAt) : null,
    attempts,
    retries,
    lastFailure: status === 'failed' ? text(entry.lastFailure) : '',
    lastAttemptAt: validTime(entry.lastAttemptAt),
  };
}

/**
 * Creates the delivery entry for a newly generated field receipt.
 * Every field receipt starts as 'generated' with no sent time and
 * no attempts; the receipt's money is untouched because this entry
 * is a separate record, not a payment field.
 */
export function createReceiptDelivery({ receiptRef = '', paymentId = '', channel = '' } = {}) {
  return normalizeReceiptDelivery({
    receiptRef,
    paymentId,
    channel,
    status: 'generated',
  });
}

/**
 * Marks a delivery entry as sent. sentAt is the time it was sent,
 * supplied by the caller; a sent entry keeps its sent time even if
 * it is marked sent again with no new time. Returns the entry
 * unchanged for non-records. Attempts count the successful attempt.
 */
export function markDeliverySent(entry, sentAt) {
  if (!isRecord(entry)) return null;
  const current = normalizeReceiptDelivery(entry);
  const time = validTime(sentAt) || current.sentAt;
  return { ...current, status: 'sent', sentAt: time, lastFailure: '', attempts: current.attempts + 1 };
}

/**
 * Queues a generated receipt for delivery. Only a 'generated'
 * entry moves to 'pending'; a sent entry is final and a failed
 * entry must be retried (markDeliveryRetry) so its retry count is
 * honest. Queuing is not an attempt, so attempts do not change.
 */
export function markDeliveryPending(entry) {
  if (!isRecord(entry)) return null;
  const current = normalizeReceiptDelivery(entry);
  if (current.status !== 'generated') return current;
  return { ...current, status: 'pending' };
}

/**
 * Marks a delivery attempt as failed. Only 'generated' and
 * 'pending' entries can fail; a sent entry is final and is
 * returned unchanged. The attempt is counted and the failure note
 * (if any) is kept for the operator. attemptedAt, when supplied,
 * is the time of the failed attempt.
 */
export function markDeliveryFailed(entry, failureNote, attemptedAt) {
  if (!isRecord(entry)) return null;
  const current = normalizeReceiptDelivery(entry);
  if (current.status === 'sent') return current;
  return {
    ...current,
    status: 'failed',
    attempts: current.attempts + 1,
    lastFailure: text(failureNote),
    lastAttemptAt: validTime(attemptedAt),
  };
}

/**
 * Retries a pending or failed receipt: it goes back to 'pending'
 * and its retry count rises by one. Generated receipts are not
 * "retried" (they are queued with markDeliveryPending) and sent
 * receipts are final; both are returned unchanged.
 */
export function markDeliveryRetry(entry, retriedAt) {
  if (!isRecord(entry)) return null;
  const current = normalizeReceiptDelivery(entry);
  if (current.status !== 'pending' && current.status !== 'failed') return current;
  return {
    ...current,
    status: 'pending',
    retries: current.retries + 1,
    lastFailure: '',
    lastAttemptAt: validTime(retriedAt),
  };
}

/**
 * Bridges the existing receipt-sharing record
 * (nav-quick-profile.js markReceiptShared) into a Plan 5 entry: a
 * shared record means the receipt was sent, with sharedAt as its
 * sent time; anything else is a fresh 'generated' entry. The
 * shared system itself is never modified.
 */
export function deliveryFromSharedRecord(receiptRef, sharedRecord) {
  if (isRecord(sharedRecord) && sharedRecord.shared === true) {
    return normalizeReceiptDelivery({
      receiptRef,
      status: 'sent',
      sentAt: sharedRecord.sharedAt,
      attempts: 1,
      channel: sharedRecord.method || '',
    });
  }
  return createReceiptDelivery({ receiptRef });
}

/**
 * The retry list: every entry whose status is 'pending' or
 * 'failed', normalised, in the caller's original order. 'sent'
 * and 'generated' receipts are never retryable — generated ones
 * have not been attempted yet, so they belong on the queue, not
 * on the retry list.
 */
export function pendingDeliveryList(entries) {
  if (!Array.isArray(entries)) return [];
  return entries
    .map((entry) => normalizeReceiptDelivery(entry))
    .filter((entry) => entry.status === 'pending' || entry.status === 'failed');
}

/**
 * Counts for a set of delivery entries. undelivered is
 * generated + pending + failed (everything not yet confirmed
 * sent); retryable is pending + failed. Counts always sum to
 * total; an empty or invalid input counts as zero of everything.
 */
export function deliverySummary(entries) {
  const summary = { total: 0, generated: 0, sent: 0, pending: 0, failed: 0, undelivered: 0, retryable: 0 };
  if (!Array.isArray(entries)) return summary;
  for (const entry of entries) {
    const current = normalizeReceiptDelivery(entry);
    summary.total += 1;
    summary[current.status] += 1;
  }
  summary.undelivered = summary.generated + summary.pending + summary.failed;
  summary.retryable = summary.pending + summary.failed;
  return summary;
}

/** Escapes HTML characters for safe template interpolation. */
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[ch]));
}

/**
 * One-line HTML chip for a delivery entry: the status label, plus
 * the sent time on a sent entry and the failure note on a failed
 * one. Receipt references and notes are escaped; the chip never
 * carries money, so it cannot misstate an amount.
 */
export function receiptDeliveryHtml(entry) {
  const current = normalizeReceiptDelivery(entry);
  const label = receiptDeliveryStatusLabel(current.status);
  let extra = '';
  if (current.status === 'sent' && current.sentAt) extra = ` · ${escapeHtml(current.sentAt)}`;
  if (current.status === 'failed' && current.lastFailure) extra = ` · ${escapeHtml(current.lastFailure)}`;
  return `<span class="receipt-delivery receipt-delivery--${current.status}">${escapeHtml(label)}${extra}</span>`;
}

/**
 * Returns a COPY of a payment (or receipt) object carrying the
 * delivery entry, leaving the original object untouched: its
 * amount, method, date and every other field are identical, and
 * the original gains no receiptDelivery key. Delivery status is
 * tracked beside the payment, never as a change to it.
 */
export function withReceiptDelivery(payment, delivery) {
  if (!isRecord(payment)) return payment;
  return { ...payment, receiptDelivery: normalizeReceiptDelivery(delivery) };
}
