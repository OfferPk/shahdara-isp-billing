// preclose-sweep.js — Plan 69 (Plan 1-100): pre-close unreconciled
// items sweep (read-only).
//
// Unapplied cash, unmatched wallet entries, and open payment claims
// drift across month ends because no single list gathers them before
// the close checklist (Plan 67) is ticked. This module is that one
// list: unclaimed suspense items (Plan O ageing), unmatched or
// disputed wallet entries (Plan V), open payment claims (Plan 63),
// and unclosed day handovers (Plan S). Each item names the screen
// that owns it, so the operator clears it there — never here.
//
// The fences, stated plainly:
//   - The sweep is recomputed fresh from caller-supplied lists on
//     every render. Clearing an item from its own screen removes it
//     from the next sweep automatically, because the sweep holds no
//     copy of its own: it stores nothing and rewrites nothing.
//   - The sweep itself resolves nothing, creates no payment, and
//     changes no bill, payment, suspense, wallet, claim, handover,
//     or month-close record. It holds no such field of its own —
//     only item ids, labels, amounts, and the screen that owns each
//     item (pinned by a field-name test).
//   - A month marked closed (Plan 67) while sweep items are still
//     open does not drop those items: they are listed again,
//     visibly, as carried-forward exceptions from that closed month.
//   - Amounts are integer cents. An unusable amount (blank,
//     boolean, negative, non-finite) is counted and named, never
//     zero-filled, and a group total goes null — not a partial sum
//     — when any line in the group is unusable (Plan 68 rule).
//     A handover day with no amount at all is still an unclosed day:
//     it counts with no amount, not as an unusable figure.
//   - Rows with no id are dropped outright, never guessed. Wallet
//     rows outside the unmatched/disputed buckets are reconciled
//     already, so they never enter the sweep. Closed claims are
//     history, so they never enter it either.
//   - Dates are strict YYYY-MM-DD calendar dates (2026-02-30 is
//     not a date) and months are strict YYYY-MM. Inputs are never
//     mutated, and the module never reads storage, the clock, or
//     the network.

const MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export const SWEEP_GROUPS = Object.freeze([
  { id: 'suspense', label: 'Unclaimed suspense', screen: 'Suspense register' },
  { id: 'wallet', label: 'Unmatched or disputed wallet entries', screen: 'Wallet ledger' },
  { id: 'claims', label: 'Open payment claims', screen: 'Payment-claim check' },
  { id: 'handovers', label: 'Unclosed day handovers', screen: 'Daily closing' },
]);

const GROUP_BY_ID = Object.fromEntries(SWEEP_GROUPS.map((group) => [group.id, group]));

function text(value) {
  return value === null || value === undefined ? '' : String(value).trim();
}

function escapeHtml(value) {
  return text(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function csvCell(value) {
  const cell = String(value ?? '');
  return /[",\n]/.test(cell) ? `"${cell.replaceAll('"', '""')}"` : cell;
}

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Strict YYYY-MM-DD calendar date, or null (2026-02-30 is not a date). */
export function validSweepDate(value) {
  const raw = text(value);
  if (!raw) return null;
  const datePart = raw.slice(0, 10);
  if (!DATE_RE.test(datePart)) return null;
  const [year, month, day] = datePart.split('-').map(Number);
  const built = new Date(Date.UTC(year, month - 1, day));
  if (built.getUTCFullYear() !== year || built.getUTCMonth() !== month - 1 || built.getUTCDate() !== day) return null;
  return datePart;
}

/** Strict YYYY-MM month key, or false. */
export function validSweepMonth(value) {
  return typeof value === 'string' && MONTH_RE.test(value);
}

/** PKR figure to integer cents, or null when unusable (never 0 for a missing figure). */
function toCents(amount) {
  if (typeof amount === 'boolean' || amount === null || amount === undefined || amount === '') return null;
  const num = Number(amount);
  if (!Number.isFinite(num) || num <= 0) return null;
  return Math.round(num * 100);
}

function fromCents(cents) {
  return cents / 100;
}

function formatAmount(value) {
  if (value === null || value === undefined) return 'Not recorded';
  return `Rs. ${Math.round(Number(value)).toLocaleString('en-US')}`;
}

function ageDaysOf(row) {
  if (row.ageDays === null || row.ageDays === undefined || row.ageDays === '') return null;
  const num = Number(row.ageDays);
  if (!Number.isFinite(num) || num < 0) return null;
  return Math.floor(num);
}

// One normalised sweep item, or null when the row is half-formed.
// amountRequired: money groups need a usable amount; a handover day
// may carry no amount and still counts as an unclosed day.
function normalizeSweepItem(groupId, raw, amountRequired) {
  if (!raw || typeof raw !== 'object') return null;
  const id = text(raw.id);
  if (!id) return null;
  const hasAmount = raw.amount !== null && raw.amount !== undefined && raw.amount !== '';
  const cents = hasAmount ? toCents(raw.amount) : null;
  if (!amountRequired && hasAmount && cents === null) {
    // A handover day whose stated amount is unusable is flagged, not
    // quietly treated as a day with no amount at all.
    return {
      group: groupId,
      id,
      label: text(raw.label) || id,
      detail: text(raw.detail),
      date: validSweepDate(raw.date),
      ageDays: ageDaysOf(raw),
      amount: null,
      amountCents: null,
      unusableAmount: true,
      screen: GROUP_BY_ID[groupId].screen,
    };
  }
  if (amountRequired && cents === null) {
    // Listed with its amount unrecorded, never zero-filled.
    return {
      group: groupId,
      id,
      label: text(raw.label) || id,
      detail: text(raw.detail),
      date: validSweepDate(raw.date),
      ageDays: ageDaysOf(raw),
      amount: null,
      amountCents: null,
      unusableAmount: true,
      screen: GROUP_BY_ID[groupId].screen,
    };
  }
  return {
    group: groupId,
    id,
    label: text(raw.label) || id,
    detail: text(raw.detail),
    date: validSweepDate(raw.date),
    ageDays: ageDaysOf(raw),
    amount: cents === null ? null : fromCents(cents),
    amountCents: cents,
    unusableAmount: false,
    screen: GROUP_BY_ID[groupId].screen,
  };
}

function sortItems(items) {
  return [...items].sort((a, b) => {
    if (a.ageDays !== null && b.ageDays !== null && a.ageDays !== b.ageDays) return b.ageDays - a.ageDays;
    if (a.ageDays !== null && b.ageDays === null) return -1;
    if (a.ageDays === null && b.ageDays !== null) return 1;
    if (a.date && b.date && a.date !== b.date) return a.date < b.date ? -1 : 1;
    if (a.date && !b.date) return -1;
    if (!a.date && b.date) return 1;
    return a.id.localeCompare(b.id);
  });
}

function buildGroup(groupId, items) {
  const unusableCount = items.filter((item) => item.unusableAmount).length;
  const usableCents = items.reduce((sum, item) => (item.amountCents === null ? sum : sum + item.amountCents), 0);
  const amountCents = unusableCount > 0 ? null : usableCents;
  return {
    id: groupId,
    label: GROUP_BY_ID[groupId].label,
    screen: GROUP_BY_ID[groupId].screen,
    count: items.length,
    amount: amountCents === null ? null : fromCents(amountCents),
    amountCents,
    unusableCount,
    items: sortItems(items),
  };
}

// A Plan 67 month-close record, read leniently: only a record whose
// month matches and whose status is closed counts as closed.
function closedMonthRecord(monthClose, month) {
  if (!monthClose || typeof monthClose !== 'object') return null;
  if (text(monthClose.month) !== month) return null;
  if (text(monthClose.status) !== 'closed') return null;
  return {
    month,
    closedDate: validSweepDate(monthClose.closedDate) || '',
    closedBy: text(monthClose.closedBy),
  };
}

/**
 * Build one pre-close sweep from caller-supplied lists.
 *
 * @param {object} input
 * @param {string} [input.month] YYYY-MM being swept ('' for no month context).
 * @param {Array} [input.suspenseItems] unclaimed suspense rows.
 * @param {Array} [input.walletItems] wallet rows; only unmatched/disputed buckets enter.
 * @param {Array} [input.claims] open payment-claim rows (closed rows are dropped).
 * @param {Array} [input.handovers] day rows; only days with handoverRecorded !== true enter.
 * @param {object|null} [input.monthClose] Plan 67 record for the month, if any.
 * @returns {object|null} null when a supplied month is not a valid YYYY-MM.
 */
export function buildPrecloseSweep(input = {}) {
  const month = text(input.month);
  if (month && !validSweepMonth(month)) return null;

  const suspenseItems = [];
  for (const raw of Array.isArray(input.suspenseItems) ? input.suspenseItems : []) {
    const item = normalizeSweepItem('suspense', raw, true);
    if (item) suspenseItems.push(item);
  }

  const walletItems = [];
  for (const raw of Array.isArray(input.walletItems) ? input.walletItems : []) {
    if (!raw || typeof raw !== 'object') continue;
    if (text(raw.bucket) !== 'unmatched' && text(raw.bucket) !== 'disputed') continue;
    const item = normalizeSweepItem('wallet', raw, true);
    if (item) walletItems.push(item);
  }

  const claimItems = [];
  for (const raw of Array.isArray(input.claims) ? input.claims : []) {
    if (!raw || typeof raw !== 'object') continue;
    if (raw.closed === true) continue;
    const item = normalizeSweepItem('claims', raw, true);
    if (item) claimItems.push(item);
  }

  const handoverItems = [];
  for (const raw of Array.isArray(input.handovers) ? input.handovers : []) {
    if (!raw || typeof raw !== 'object') continue;
    if (raw.handoverRecorded === true) continue;
    // A day is identified by its date; a row with neither an id nor
    // a date is still half-formed and is dropped.
    const item = normalizeSweepItem('handovers', { ...raw, id: text(raw.id) || text(raw.date) }, false);
    if (item) handoverItems.push(item);
  }

  const groups = [
    buildGroup('suspense', suspenseItems),
    buildGroup('wallet', walletItems),
    buildGroup('claims', claimItems),
    buildGroup('handovers', handoverItems),
  ];
  const totalCount = groups.reduce((sum, group) => sum + group.count, 0);
  const unusableCount = groups.reduce((sum, group) => sum + group.unusableCount, 0);
  const totalCents = groups.some((group) => group.amountCents === null && group.count > 0)
    ? null
    : groups.reduce((sum, group) => sum + (group.amountCents ?? 0), 0);
  const closed = month ? closedMonthRecord(input.monthClose, month) : null;
  // A closed month never drops its still-open items: they are listed
  // again, visibly, as carried-forward exceptions.
  const carriedForward = closed && totalCount > 0
    ? groups.flatMap((group) => group.items.map((item) => ({ ...item, carriedFrom: month })))
    : [];

  return {
    month,
    groups,
    totalCount,
    totalAmount: totalCents === null ? null : fromCents(totalCents),
    totalCents,
    unusableCount,
    closedMonth: closed,
    carriedForward,
    items: groups.flatMap((group) => group.items),
  };
}

export function precloseSweepSummaryText(sweep) {
  if (!sweep) return 'Pick a valid month to run the pre-close sweep.';
  if (sweep.totalCount === 0) {
    return sweep.month
      ? `Pre-close sweep for ${sweep.month}: nothing unreconciled — no unclaimed suspense, unmatched wallet entries, open payment claims, or unclosed day handovers.`
      : 'Pre-close sweep: nothing unreconciled.';
  }
  const parts = sweep.groups
    .filter((group) => group.count > 0)
    .map((group) => `${group.count} ${group.label.toLowerCase()}${group.amount === null ? '' : ` (${formatAmount(group.amount)})`}`);
  let textOut = sweep.month ? `Pre-close sweep for ${sweep.month}: ` : 'Pre-close sweep: ';
  textOut += `${sweep.totalCount} unreconciled item${sweep.totalCount === 1 ? '' : 's'} — ${parts.join(', ')}.`;
  if (sweep.unusableCount > 0) textOut += ` ${sweep.unusableCount} item${sweep.unusableCount === 1 ? '' : 's'} carry an unusable amount, shown as not recorded, never zero-filled.`;
  if (sweep.carriedForward.length > 0) {
    textOut += ` Month ${sweep.month} is marked closed with these items still open: they are carried forward below as exceptions, never silently dropped.`;
  }
  return textOut;
}

export function precloseSweepHtml(sweep) {
  if (!sweep) return '<p style="font-size: 12px;">Pick a valid month to run the pre-close sweep.</p>';
  if (sweep.totalCount === 0) {
    return '<p style="font-size: 12px;">Nothing unreconciled: no unclaimed suspense, unmatched wallet entries, open payment claims, or unclosed day handovers.</p>';
  }
  const groupHtml = sweep.groups.filter((group) => group.count > 0).map((group) => {
    const rows = group.items.map((item) => {
      const bits = [`<strong>${escapeHtml(item.label)}</strong>`];
      if (item.detail) bits.push(escapeHtml(item.detail));
      if (item.date) bits.push(escapeHtml(item.date));
      if (item.ageDays !== null) bits.push(`${item.ageDays} days`);
      bits.push(item.amount === null ? 'Amount not recorded' : escapeHtml(formatAmount(item.amount)));
      bits.push(`Clear from: ${escapeHtml(item.screen)}`);
      return `<li>${bits.join(' · ')}</li>`;
    }).join('');
    return `<h4 style="font-size: 13px; margin: 10px 0 4px;">${escapeHtml(group.label)} — ${group.count} item${group.count === 1 ? '' : 's'}${group.amount === null ? '' : ` · ${escapeHtml(formatAmount(group.amount))}`}</h4><ul style="font-size: 12px;">${rows}</ul>`;
  }).join('');
  const carriedHtml = sweep.carriedForward.length > 0
    ? `<h4 style="font-size: 13px; margin: 10px 0 4px;">Carried-forward exceptions from closed month ${escapeHtml(sweep.month)}${sweep.closedMonth?.closedDate ? ` (closed ${escapeHtml(sweep.closedMonth.closedDate)}${sweep.closedMonth.closedBy ? ` by ${escapeHtml(sweep.closedMonth.closedBy)}` : ''})` : ''}</h4><p style="font-size: 12px;">These ${sweep.carriedForward.length} item${sweep.carriedForward.length === 1 ? '' : 's'} were still open when the month was marked closed. They stay visible here until cleared from their own screen.</p>`
    : '';
  return groupHtml + carriedHtml;
}

export function precloseSweepCsv(sweep) {
  if (!sweep) return '';
  const header = 'month,group,screen,id,label,detail,date,age_days,amount,carried_forward';
  const lines = sweep.groups.flatMap((group) => group.items.map((item) => [
    sweep.month,
    group.label,
    group.screen,
    item.id,
    item.label,
    item.detail,
    item.date ?? '',
    item.ageDays === null ? '' : item.ageDays,
    item.amount === null ? '' : item.amount,
    sweep.carriedForward.some((carried) => carried.group === item.group && carried.id === item.id) ? 'yes' : 'no',
  ].map(csvCell).join(',')));
  return [header, ...lines].join('\n');
}

export function precloseSweepFilename(month) {
  return validSweepMonth(month) ? `preclose-sweep-${month}.csv` : 'preclose-sweep.csv';
}
