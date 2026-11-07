// Plan 449 — Quick Collect payment for a second connection from
// the same screen: after the first connection's payment, offer the
// customer's other connection with its dues, recordable in the same
// pass — one counter visit, two payments, two honest receipts.
//
// What already exists, and what this plan does NOT rebuild: the
// two-connection combined view (Plan 127) already lists each
// connection's dues and their combined total from caller-supplied
// rows, and the second-connection link record (Plan 230) already
// names a customer's two connections for billing presentation and
// collection. Neither one records a payment, and Quick Collect
// itself has no second-connection step at all: today the operator
// must leave the success screen and start a whole new visit for
// the second connection. This module adds only the missing piece:
// the step itself — which connection is the other one, what amount
// to suggest for it, and the running total of the two payments
// together — as a pure view over caller-supplied data. It records
// nothing: the wiring records the second payment through the
// existing save path, and the step never changes any bill, payment
// total, connection, or link record by itself.
//
// The other connection comes from the customer's active link
// record, supplied by the caller: the first payment names no
// connection (Quick Collect payments never have), so the first
// connection is the link's primary one and the other is the
// linked one. When a first payment does name one of the two, the
// other is the remaining one. A customer with no active link, or
// a link that names the same connection twice, offers no step.
//
// The suggested amount is the customer's remaining dues after the
// first payment — every open bill's remaining balance plus unpaid
// manual baqaya, the same figure the still-owes line shows — and
// deliberately NOT a per-connection figure: the app stores no
// per-connection bills, so no per-connection dues exist to read,
// and this module never invents one. The operator types the second
// connection's actual figure when it differs from the suggestion;
// the suggestion is only the starting amount. The two payments
// together are shown as one total, so the operator checks them
// against what the customer paid before recording the second.
//
// The module is standalone: it reads no storage, no clock, and no
// page, takes no other module, and never mutates an input. Every
// figure comes from the caller: the link list, the first payment,
// and the remaining dues. A figure that is not a number is "not a
// number", never zero.

const SECOND_CONNECTION_NAME_CAP = 60;
const SECOND_CONNECTION_METHOD_CAP = 40;

function cleanSecondConnectionText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function foldSecondConnectionId(value) {
  return cleanSecondConnectionText(value).replace(/\s+/g, ' ').toLowerCase();
}

/**
 * One amount to integer cents, without ever guessing the unit: an
 * `amountCents` integer is used as-is, while a plain `amount` is
 * always rupees and converts exactly once (×100). Anything else is null.
 */
export function secondConnectionAmountCents(value) {
  if (!value || typeof value !== 'object') return null;
  if (Number.isInteger(value.amountCents)) return value.amountCents;
  if (typeof value.amount === 'number' && Number.isFinite(value.amount)) {
    return Math.round(value.amount * 100);
  }
  if (typeof value.amount === 'string' && value.amount.trim() !== '') {
    const parsed = Number(value.amount.trim());
    if (Number.isFinite(parsed)) return Math.round(parsed * 100);
  }
  return null;
}

// A figure counts only when it is a finite number: null, undefined,
// an empty string, or a boolean is "not a number", never zero — a
// null figure must never invent a zero dues, and a boolean must
// never read as one rupee.
export function secondConnectionFigure(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return value;
}

/** A usable second amount, in whole cents, or null when it is not one. */
export function secondConnectionValidAmountCents(value) {
  const cents = secondConnectionAmountCents(value);
  if (cents === null || !Number.isInteger(cents) || cents <= 0) return null;
  return cents;
}

/** Format an amount the way the app shows money (min-0 decimals). */
export function formatSecondConnectionAmount(amount) {
  if (typeof amount !== 'number' || !Number.isFinite(amount)) return 'Not set';
  return `PKR ${Number(amount).toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function cappedSecondConnectionText(value, cap) {
  return String(value ?? '').trim().slice(0, cap);
}

/**
 * The customer's active link record from a caller-supplied list,
 * or null: one active record per customer, matched on the folded
 * customer id, with no unlink date. A record that names the same
 * connection on both sides is not a link at all.
 */
export function secondConnectionActiveLink(links, customerId) {
  const wanted = foldSecondConnectionId(customerId);
  if (!wanted || !Array.isArray(links)) return null;
  for (const raw of links) {
    if (!raw || typeof raw !== 'object') continue;
    if (foldSecondConnectionId(raw.customer) !== wanted) continue;
    if (cleanSecondConnectionText(raw.dateUnlinked) !== '') continue;
    const primary = cappedSecondConnectionText(raw.primaryConnection, SECOND_CONNECTION_NAME_CAP);
    const linked = cappedSecondConnectionText(raw.linkedConnection, SECOND_CONNECTION_NAME_CAP);
    if (!primary || !linked) return null;
    if (foldSecondConnectionId(primary) === foldSecondConnectionId(linked)) return null;
    return { customer: cleanSecondConnectionText(raw.customer), primaryConnection: primary, linkedConnection: linked };
  }
  return null;
}

/**
 * The second-connection step for one just-saved first payment, or
 * null when there is no step to offer: no active link for the
 * customer, a link that names the same connection twice, no usable
 * first payment, or nothing still owed for the second connection.
 * The first payment names no connection on an ordinary Quick
 * Collect save, so the first connection is the link's primary one
 * and the other is the linked one; a first payment that does name
 * one of the two makes the other one the second.
 *
 * @param {Object} input - { links, customerId, firstPayment, remainingDuesCents }.
 * @param {Array} input.links - caller-supplied link records.
 * @param {string} input.customerId - the customer just paid.
 * @param {Object} input.firstPayment - { connection, amountCents, method }.
 * @param {number} input.remainingDuesCents - dues left after the first payment, in cents.
 * @returns {Object|null} { customerId, firstConnection, secondConnection, firstPaymentCents, suggestedCents, method }.
 */
export function secondConnectionStep({ links, customerId, firstPayment, remainingDuesCents } = {}) {
  const link = secondConnectionActiveLink(links, customerId);
  if (!link) return null;
  const firstCents = secondConnectionAmountCents(firstPayment);
  if (firstCents === null || firstCents <= 0) return null;
  const remaining = secondConnectionFigure(remainingDuesCents);
  if (remaining === null || remaining <= 0) return null;
  const firstConnectionName = foldSecondConnectionId(firstPayment?.connection);
  let firstConnection = link.primaryConnection;
  let secondConnection = link.linkedConnection;
  if (firstConnectionName !== '') {
    if (firstConnectionName === foldSecondConnectionId(link.primaryConnection)) {
      firstConnection = link.primaryConnection;
      secondConnection = link.linkedConnection;
    } else if (firstConnectionName === foldSecondConnectionId(link.linkedConnection)) {
      firstConnection = link.linkedConnection;
      secondConnection = link.primaryConnection;
    }
  }
  return {
    customerId: cleanSecondConnectionText(customerId),
    firstConnection,
    secondConnection,
    firstPaymentCents: firstCents,
    suggestedCents: Math.round(remaining),
    method: cappedSecondConnectionText(firstPayment?.method, SECOND_CONNECTION_METHOD_CAP),
  };
}

/**
 * The two payments together, in whole cents, or null when either
 * figure is unusable — the check that the pair matches what the
 * customer paid in this visit.
 */
export function secondConnectionTotalCents(firstPaymentCents, secondAmountCents) {
  const first = secondConnectionFigure(firstPaymentCents);
  const second = secondConnectionFigure(secondAmountCents);
  if (first === null || second === null) return null;
  return Math.round(first) + Math.round(second);
}

// The step as one plain-text line, for the screen-reader
// announcement and for tests: first connection paid, second
// connection amount, and the total of the two together. An
// unusable second amount falls back to the suggested amount, so
// the line always shows the pair the operator is about to record.
export function secondConnectionSummaryText(step, secondAmountCents) {
  if (!step || typeof step !== 'object') return '';
  if (typeof step.firstConnection !== 'string' || step.firstConnection === '') return '';
  if (typeof step.secondConnection !== 'string' || step.secondConnection === '') return '';
  const second = secondConnectionFigure(secondAmountCents);
  const shownSecondCents = second !== null && second > 0 ? Math.round(second) : step.suggestedCents;
  const totalCents = secondConnectionTotalCents(step.firstPaymentCents, shownSecondCents);
  if (totalCents === null) return '';
  return `${step.firstConnection} ${formatSecondConnectionAmount(step.firstPaymentCents / 100)} paid · ${step.secondConnection} ${formatSecondConnectionAmount(shownSecondCents / 100)} → Total paid ${formatSecondConnectionAmount(totalCents / 100)}`;
}

/** Escapes HTML characters for safe template string interpolation. */
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
 * The step markup: the other connection by name, the suggested
 * amount (the customer's remaining dues — editable), the method
 * the second payment will reuse, the running total of the two
 * payments, and Record / Skip. Every value is escaped, so a
 * connection name typed on a link record can never break out of
 * the step. An unusable step renders nothing.
 */
export function secondConnectionStepHtml(step) {
  if (!step || typeof step !== 'object') return '';
  if (typeof step.secondConnection !== 'string' || step.secondConnection === '') return '';
  if (typeof step.firstConnection !== 'string' || step.firstConnection === '') return '';
  const suggested = typeof step.suggestedCents === 'number' && Number.isFinite(step.suggestedCents)
    ? step.suggestedCents / 100
    : null;
  if (suggested === null || suggested <= 0) return '';
  const total = secondConnectionSummaryText(step, step.suggestedCents);
  const methodLine = typeof step.method === 'string' && step.method !== ''
    ? `<p class="scc-method">Method: ${escapeHtml(step.method)} (same as the first payment)</p>`
    : '';
  return `<p class="scc-title"><strong>Second connection — ${escapeHtml(step.secondConnection)}</strong></p>`
    + `<p class="scc-dues">Still owed ${formatSecondConnectionAmount(suggested)} — suggested for ${escapeHtml(step.secondConnection)}. Change the amount when the second connection owes something else.</p>`
    + `<label class="field-label" for="sccSecondConnectionAmount">Amount for ${escapeHtml(step.secondConnection)}</label>`
    + `<input id="sccSecondConnectionAmount" class="scc-amount" type="number" min="0.01" step="0.01" inputmode="decimal" value="${suggested.toFixed(2)}">`
    + methodLine
    + `<p id="sccSecondConnectionTotal" class="scc-total" aria-live="polite">${escapeHtml(total)}</p>`
    + `<button id="sccSecondConnectionRecord" type="button" class="primary-button scc-record-button">Record second payment</button> `
    + `<button id="sccSecondConnectionDismiss" type="button" class="secondary-button">Skip</button>`;
}
