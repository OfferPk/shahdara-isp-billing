// Plan 428 — Quick Collect recent customers quick-pick: the
// regulars at the counter are one tap away, so the morning queue
// moves in minutes instead of half an hour.
//
// What already exists, and what this plan does NOT rebuild: the
// dashboard already lists recent payments, and the profile already
// keeps a recently-viewed list (Plan 354) — but the dashboard card
// is a payments list, not a pick row, and the viewed list records
// which profiles the operator opened, not which customers were
// collected from. A customer viewed but never paid must never appear
// here, and a customer paid at the counter without opening the
// profile must. So this module adds only the missing piece: the last
// ten customers collected from, latest first, with name, mohalla,
// and dues — derived from the payment records the app already
// projects, so no store of its own is needed, because the payments
// already recorded on this device ARE the list.
//
// The row picks only. It never changes any bill, payment, or
// customer record, and it never sends anything. Inputs are never
// mutated, and the module never reads storage, the clock, the
// network, or the page.

export const RECENT_QUICK_PICK_MAX = 10;
export const RECENT_QUICK_PICK_UNASSIGNED_TEXT = 'Unassigned';

const STRICT_QUICK_PICK_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

function escapeRecentQuickPickHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[ch]));
}

function isLeapYear(year) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

/**
 * Whether the value is a strict YYYY-MM-DD calendar date (month
 * 01-12, a real day for that month, leap-aware). A blank, a typo, a
 * month outside 01-12, or a day that month never has — 30 February,
 * 31 April, 29 February in a common year — is never a collected
 * date, and the payment is never placed on the row by a guess.
 */
export function isStrictRecentQuickPickDate(value) {
  if (typeof value !== 'string') return false;
  const match = STRICT_QUICK_PICK_DATE.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12) return false;
  const daysInMonth = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  return day >= 1 && day <= daysInMonth;
}

function cleanRecentQuickPickText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function recentQuickPickMohalla(customer) {
  if (!customer || typeof customer !== 'object') return RECENT_QUICK_PICK_UNASSIGNED_TEXT;
  const mohalla = cleanRecentQuickPickText(customer.mohalla);
  if (mohalla) return mohalla;
  const area = cleanRecentQuickPickText(customer.area);
  if (area) return area;
  return RECENT_QUICK_PICK_UNASSIGNED_TEXT;
}

// PKR in the plan modules' own shape: min-0 decimals, never more
// than two (PKR 3,000 · PKR 1,500.5). A null/undefined/empty/boolean
// figure is "not a number", never zero — a missing dues figure must
// never be printed as PKR 0.
export function finiteRecentQuickPickCents(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return Math.round(value);
}

export function formatRecentQuickPickAmount(cents) {
  const finite = finiteRecentQuickPickCents(cents);
  if (finite === null) return null;
  const rupees = finite / 100;
  return `PKR ${rupees.toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

// Rank key for one payment: the payment date first, then the
// recorded-at stamp for same-day payments, then the payment id —
// all plain strings, latest wins, so the order is deterministic
// whatever order the rows arrive in.
function recentQuickPickRankKey(row) {
  return [
    row.date,
    String(row.recordedAt ?? ''),
    String(row.paymentId ?? row.id ?? ''),
  ];
}

function compareRecentQuickPickRankKeys(a, b) {
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1;
  }
  return 0;
}

function recentQuickPickDuesCents(duesCentsById, customerId) {
  if (!duesCentsById || typeof duesCentsById !== 'object') return null;
  const dues = duesCentsById instanceof Map
    ? duesCentsById.get(customerId)
    : duesCentsById[customerId];
  const finite = finiteRecentQuickPickCents(dues);
  if (finite === null) return null;
  return Math.max(0, finite);
}

/**
 * The last ten customers collected from, latest first.
 *
 * @param {Object[]} customers — the customer records.
 * @param {Object[]} transactions — the transaction rows the app
 *   already projects (one row per payment, with customerId, date,
 *   recordedAt, voided, paymentId).
 * @param {Object|Map} duesCentsById — the caller's total dues per
 *   customer id, in cents (the picker's own shared total, bills plus
 *   unpaid manual baqaya). A customer with no figure reads as dues
 *   not recorded, never as zero.
 * @returns {Object[]} Entries { id, customerNumber, name, mohalla,
 *   duesCents, lastCollectedDate, lastCollectedRecordedAt }, at most
 *   ten, latest collected first, no duplicates.
 */
export function recentQuickPickEntries(customers, transactions, duesCentsById) {
  if (!Array.isArray(customers) || !Array.isArray(transactions)) return [];
  const byId = new Map();
  for (const customer of customers) {
    if (!customer || typeof customer !== 'object') continue;
    if (typeof customer.id !== 'string' || !customer.id) continue;
    if (!byId.has(customer.id)) byId.set(customer.id, customer);
  }
  // Latest payment per customer. A voided payment never counts as
  // collected-from, and a payment with no strict date cannot be
  // ranked, so it never places its customer on the row.
  const latestByCustomer = new Map();
  for (const row of transactions) {
    if (!row || typeof row !== 'object') continue;
    if (row.voided === true) continue;
    if (typeof row.customerId !== 'string' || !row.customerId) continue;
    if (!isStrictRecentQuickPickDate(row.date)) continue;
    const key = recentQuickPickRankKey(row);
    const current = latestByCustomer.get(row.customerId);
    if (!current || compareRecentQuickPickRankKeys(current.key, key) < 0) {
      latestByCustomer.set(row.customerId, {
        customerId: row.customerId,
        date: row.date,
        recordedAt: String(row.recordedAt ?? ''),
        key,
      });
    }
  }
  const entries = [];
  for (const latest of latestByCustomer.values()) {
    const customer = byId.get(latest.customerId);
    if (!customer) continue;
    if (customer.archived) continue;
    if (typeof customer.name !== 'string' || !customer.name.trim()) continue;
    entries.push({
      id: customer.id,
      customerNumber: customer.customerNumber ?? null,
      name: customer.name.trim(),
      mohalla: recentQuickPickMohalla(customer),
      duesCents: recentQuickPickDuesCents(duesCentsById, latest.customerId),
      lastCollectedDate: latest.date,
      lastCollectedRecordedAt: latest.recordedAt,
    });
  }
  entries.sort((a, b) => {
    if (a.lastCollectedDate !== b.lastCollectedDate) {
      return a.lastCollectedDate < b.lastCollectedDate ? 1 : -1;
    }
    if (a.lastCollectedRecordedAt !== b.lastCollectedRecordedAt) {
      return a.lastCollectedRecordedAt < b.lastCollectedRecordedAt ? 1 : -1;
    }
    return String(a.name).localeCompare(String(b.name))
      || String(a.id).localeCompare(String(b.id));
  });
  return entries.slice(0, RECENT_QUICK_PICK_MAX);
}

export function recentQuickPickDuesText(entry) {
  if (!entry || typeof entry !== 'object') return 'Dues not recorded';
  const finite = finiteRecentQuickPickCents(entry.duesCents);
  if (finite === null) return 'Dues not recorded';
  const amount = formatRecentQuickPickAmount(finite);
  if (finite === 0) return `${amount} · Settled`;
  return `${amount} · Due`;
}

export function recentQuickPickLineText(entry) {
  if (!entry || typeof entry !== 'object') return '';
  return `${entry.name} — ${entry.mohalla} · ${recentQuickPickDuesText(entry)}`;
}

// QC Cash Modal Overhaul: "Collected 2026-11-10" becomes a compact
// "10 Nov" badge — a pure month-name lookup, no Date/clock, so the
// module stays time-free. An invalid date never renders a badge.
const RECENT_QUICK_PICK_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatRecentQuickPickShortDate(value) {
  if (!isStrictRecentQuickPickDate(value)) return null;
  const match = STRICT_QUICK_PICK_DATE.exec(value);
  return `${Number(match[3])} ${RECENT_QUICK_PICK_MONTHS[Number(match[2]) - 1]}`;
}

export function recentQuickPickHtml(entries) {
  if (!Array.isArray(entries) || entries.length === 0) return '';
  // QC Cash Modal Overhaul: Recent collapses into an accordion —
  // one summary line ("Recent: N collected (latest: #N Name) ▾")
  // with the rows hidden until the operator taps it, so the nine
  // expanded cards no longer sit above the unpaid queue. The rows
  // keep their pick behaviour; the toggle carries no .rqp-row, so
  // the list's click delegation cannot mistake it for a pick.
  // Entries arrive latest-first, so entries[0] is the latest.
  const latest = entries[0];
  const latestNumber = latest.customerNumber === null || latest.customerNumber === undefined
    ? '' : `#${escapeRecentQuickPickHtml(String(latest.customerNumber))} `;
  const summary = `Recent: ${entries.length} collected (latest: ${latestNumber}${escapeRecentQuickPickHtml(latest.name)})`;
  const rows = entries.map((entry) => {
    const number = entry.customerNumber === null || entry.customerNumber === undefined
      ? '' : `#${escapeRecentQuickPickHtml(String(entry.customerNumber))}`;
    const shortDate = formatRecentQuickPickShortDate(entry.lastCollectedDate);
    const dateBadge = shortDate !== null
      ? `<span class="qc-cust-meta rqp-date-badge">${escapeRecentQuickPickHtml(shortDate)}</span>`
      : `<span class="qc-cust-meta">Collected ${escapeRecentQuickPickHtml(entry.lastCollectedDate)}</span>`;
    return `
      <button type="button"
              class="qc-customer-card rqp-row"
              data-customer-id="${escapeRecentQuickPickHtml(entry.id)}"
              aria-label="Pick ${escapeRecentQuickPickHtml(entry.name)}">
        <div class="qc-card-left">
          ${number ? `<span class="qc-cust-num">${number}</span>` : ''}
          <div class="qc-cust-info">
            <span class="qc-cust-name">${escapeRecentQuickPickHtml(entry.name)}</span>
            <span class="qc-cust-meta">${escapeRecentQuickPickHtml(entry.mohalla)} · ${escapeRecentQuickPickHtml(recentQuickPickDuesText(entry))}</span>
          </div>
        </div>
        <div class="qc-card-right">
          ${dateBadge}
        </div>
      </button>
    `;
  }).join('');
  return `<button type="button" class="rqp-toggle" aria-expanded="false"><span class="rqp-toggle-label">${summary}</span><span class="rqp-toggle-chevron" aria-hidden="true">▾</span></button><div class="rqp-rows" hidden>${rows}</div>`;
}
