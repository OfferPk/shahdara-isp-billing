// Plan 447 — Quick Collect big name and mohalla confirmation before
// saving: one big line on the payment form naming the selected
// customer in large text, with mohalla and current dues, so the
// operator catches a wrong-customer pick by eye before tapping
// Save. At a busy counter the chosen customer is otherwise shown
// only in small text that is easy to miss when two customers share
// a similar name.
//
// What already exists, and what this plan does NOT rebuild: the
// confirm step (Plan 382) already shows a name + mohalla + amount
// summary when the operator confirms a save — but only at confirm
// time, after the form is already filled in. This module adds only
// the missing piece: the always-visible line on the sheet itself,
// refreshed the moment the customer changes, before anything is
// typed. It confirms only and it posts nothing: it never changes
// any bill, payment, or customer record, holds no store of its own,
// and reads no storage, clock, or network. Every figure comes from
// the caller: the customer record and the dues figure the picker
// already shows.
//
// The dues figure is the customer's DUES — every open bill's
// remaining balance plus unpaid manual baqaya, the same shared
// total the picker shows and the amount field defaults to — and
// deliberately NOT the payable remainder: the payable also folds
// in ticket and boost charges still pending, and those are not
// dues. A customer with no dues left reads "Dues PKR 0": the line
// never invents a bill, and never calls a customer fully paid on
// the strength of a figure it could not work out — when the dues
// figure is not a usable number, the dues part is left out
// entirely instead of guessed.

const BIG_NAME_CONFIRM_NAME_CAP = 100;
const BIG_NAME_CONFIRM_MOHALLA_CAP = 60;

export const BIG_NAME_CONFIRM_UNASSIGNED_MOHALLA = 'Unassigned';

function cleanBigNameConfirmText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

// A figure counts only when it is a finite number: null, undefined,
// an empty string, or a boolean is "not a number", never zero — a
// null figure must never invent a zero dues, and a boolean must
// never read as one rupee. (Same defensive rule as the still-owes
// line's figure check.)
export function bigNameConfirmFigure(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return value;
}

/** Format an amount the way the app shows money (min-0 decimals). */
export function formatBigNameConfirmAmount(amount) {
  return Number(amount).toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function cappedText(value, cap) {
  return String(value ?? '').trim().slice(0, cap);
}

// The mohalla the line shows: the record's own mohalla first, the
// legacy area field second, 'Unassigned' when neither is recorded —
// the same order the payment defaults already use, so the line and
// the header above it never disagree about where the customer is.
export function bigNameConfirmMohalla(customer) {
  if (!customer || typeof customer !== 'object') return BIG_NAME_CONFIRM_UNASSIGNED_MOHALLA;
  const mohalla = cappedText(customer.mohalla, BIG_NAME_CONFIRM_MOHALLA_CAP);
  if (mohalla) return mohalla;
  const area = cappedText(customer.area, BIG_NAME_CONFIRM_MOHALLA_CAP);
  if (area) return area;
  return BIG_NAME_CONFIRM_UNASSIGNED_MOHALLA;
}

/**
 * The normalized confirmation line for one selected customer, or
 * null when there is no usable customer to confirm — no usable id,
 * or no name at all. A customer with an unusable dues figure still
 * gets a line: the name and mohalla are worth confirming on their
 * own, and the dues part is simply left out rather than guessed.
 *
 * @param {Object} customer - the customer record ({ id, name, mohalla, area }).
 * @param {number} duesRupees - current dues in rupees (open bills + unpaid manual baqaya).
 * @returns {Object|null} { customerId, name, mohalla, dues, duesKnown }.
 */
export function bigNameConfirmLine(customer, duesRupees) {
  if (!customer || typeof customer !== 'object') return null;
  const customerId = cleanBigNameConfirmText(customer.id);
  if (!customerId) return null;
  const name = cappedText(customer.name ?? customer.customerName, BIG_NAME_CONFIRM_NAME_CAP);
  if (!name) return null;
  const dues = bigNameConfirmFigure(duesRupees);
  return {
    customerId,
    name,
    mohalla: bigNameConfirmMohalla(customer),
    dues,
    duesKnown: dues !== null,
  };
}

// The line as one plain-text line, for the screen-reader
// announcement and for tests: name, mohalla, and dues when known.
export function bigNameConfirmLineText(line) {
  if (!line || typeof line !== 'object') return '';
  if (typeof line.name !== 'string' || line.name === '') return '';
  const parts = [line.name];
  if (typeof line.mohalla === 'string' && line.mohalla !== '') parts.push(line.mohalla);
  if (line.duesKnown && typeof line.dues === 'number' && Number.isFinite(line.dues)) {
    parts.push(`Dues PKR ${formatBigNameConfirmAmount(line.dues)}`);
  }
  return parts.join(' — ');
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
 * The line markup: the name large and bold, the mohalla beside it,
 * and the dues in the receipt card's own balance colours — amber
 * while something is still owed, green when the dues are settled —
 * so no new colour enters the stylesheet. Every value is escaped,
 * so a name typed on a record can never break out of the line.
 * An unusable line renders nothing.
 */
export function bigNameConfirmLineHtml(line) {
  if (!line || typeof line !== 'object') return '';
  if (typeof line.name !== 'string' || line.name === '') return '';
  const name = `<strong class="bnc-name">${escapeHtml(line.name)}</strong>`;
  const mohalla = `<span class="bnc-mohalla">${escapeHtml(line.mohalla)}</span>`;
  if (!line.duesKnown || typeof line.dues !== 'number' || !Number.isFinite(line.dues)) {
    return `${name} <span class="bnc-sep">—</span> ${mohalla}`;
  }
  const duesClass = line.dues > 0 ? 'qc-meta-val has-balance' : 'qc-meta-val zero-balance';
  const dues = `<strong class="${duesClass}">Dues PKR ${formatBigNameConfirmAmount(line.dues)}</strong>`;
  return `${name} <span class="bnc-sep">—</span> ${mohalla} <span class="bnc-sep">—</span> ${dues}`;
}
