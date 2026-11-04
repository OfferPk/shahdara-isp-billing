// Plan 103 (Plan 101-202) — Customer credit balance from overpayment.
//
// This module is the CREDIT RECORD and the CREDIT VIEW only, and
// nothing else:
//
//   - It is pure and import-free: the caller supplies every credit
//     entry and every application, and the module never reads
//     storage, the clock, or the network, and never mutates an
//     input. It never reads or rewrites any payment, bill, or
//     Plan 102 part-payment allocation — a Plan 102 unallocated
//     remainder may be *supplied* as the amount of a credit entry
//     by the caller, but this module never opens that record itself.
//   - One credit-balance record per customer, built from entries
//     created only from an identified overpayment or an approved
//     adjustment. An overpayment entry names its source payment;
//     an adjustment entry carries its approval note. Anything else
//     is refused outright.
//   - Credit is applied to a bill ONLY by an operator-recorded
//     application that names the bill it settles. There is no
//     automatic application and no silent application anywhere in
//     this module: an application that names no bill, exceeds the
//     remaining credit, or points at an unknown entry is refused
//     and the lists are left exactly unchanged.
//   - Credit in, credit applied, and credit remaining always sum
//     exactly, in integer cents, with no rounding anywhere: rupees
//     convert to cents exactly once on the way in and cents are
//     never converted back.
//   - Credit is NEVER converted to cash here. There is no cash-out
//     path in this module at all: turning credit into cash needs a
//     refund record, and that is Plan 116's work, a future plan,
//     not built here. This module only records credit and its
//     applications to bills.
//   - No past payment is ever rewritten: entries and applications
//     are records of their own, and every function returns fresh
//     objects, never edited inputs.

function cleanText(value) {
  if (value === null || value === undefined) return '';
  return String(value).normalize('NFKC').trim();
}

function isNonNegativeInteger(value) {
  return Number.isInteger(value) && value >= 0;
}

/** Strict calendar date: YYYY-MM-DD that really exists. */
export function validCreditDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/**
 * One amount to integer cents, without ever guessing the unit: an
 * `amountCents` integer is used as-is, while a plain `amount` is
 * always rupees and converts exactly once (×100). Anything else is null.
 */
export function creditAmountCents(value) {
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

function formatRs(cents) {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  return `${sign}Rs. ${(abs / 100).toFixed(2)}`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const CREDIT_SOURCES = ['overpayment', 'adjustment'];

/**
 * Normalise one credit entry, or null when half-formed. Unknown
 * fields are dropped, so an entry carries exactly its own keys.
 * An overpayment must name its source payment; an adjustment must
 * carry its approval note — otherwise the entry is refused.
 */
export function normalizeCreditEntry(value) {
  if (!value || typeof value !== 'object') return null;
  const id = cleanText(value.id);
  const customerId = cleanText(value.customerId ?? value.customer);
  const source = cleanText(value.source);
  if (id === '' || customerId === '' || !CREDIT_SOURCES.includes(source)) return null;
  const amountCents = creditAmountCents(value);
  if (amountCents === null || amountCents <= 0) return null;
  const date = cleanText(value.date);
  if (date !== '' && !validCreditDate(date)) return null;
  const sourcePaymentId = cleanText(value.sourcePaymentId ?? value.paymentId);
  const note = cleanText(value.note ?? value.reason);
  if (source === 'overpayment' && sourcePaymentId === '') return null;
  if (source === 'adjustment' && note === '') return null;
  return {
    id,
    customerId,
    customerName: cleanText(value.customerName ?? value.name),
    source,
    sourcePaymentId,
    amountCents,
    date,
    note,
  };
}

/** Normalise a list of credit entries, dropping every half-formed one. */
export function normalizeCreditEntryList(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const entry of list) {
    const clean = normalizeCreditEntry(entry);
    if (clean) out.push(clean);
  }
  return out;
}

/**
 * Insert or replace one credit entry. Returns the new list, or null
 * when the entry is half-formed — the caller's list is then left
 * exactly unchanged. A second entry with the same id replaces the
 * first, so one stored record per entry id is all there ever is.
 */
export function upsertCreditEntry(list, entry) {
  const clean = normalizeCreditEntry(entry);
  if (!clean) return null;
  const base = normalizeCreditEntryList(list);
  const next = base.filter((item) => item.id !== clean.id);
  next.push(clean);
  return next;
}

/**
 * Remove one credit entry. Returns the new list, or null when the
 * entry is still named by an application — an applied credit cannot
 * be silently deleted out from under its own application history.
 */
export function removeCreditEntry(list, applications, id) {
  const cleanId = cleanText(id);
  if (cleanId === '') return null;
  const apps = normalizeCreditApplicationList(applications);
  if (apps.some((app) => app.creditEntryId === cleanId)) return null;
  return normalizeCreditEntryList(list).filter((item) => item.id !== cleanId);
}

/**
 * Normalise one credit application, or null when half-formed.
 * An application must name the credit entry it draws on AND the
 * bill it settles — an application naming no bill is refused.
 */
export function normalizeCreditApplication(value) {
  if (!value || typeof value !== 'object') return null;
  const id = cleanText(value.id);
  const creditEntryId = cleanText(value.creditEntryId ?? value.entryId);
  const customerId = cleanText(value.customerId ?? value.customer);
  const billId = cleanText(value.billId ?? value.bill);
  if (id === '' || creditEntryId === '' || customerId === '' || billId === '') return null;
  const amountCents = creditAmountCents(value);
  if (amountCents === null || amountCents <= 0) return null;
  const date = cleanText(value.date);
  if (date !== '' && !validCreditDate(date)) return null;
  return {
    id,
    creditEntryId,
    customerId,
    billId,
    billLabel: cleanText(value.billLabel ?? value.billMonth),
    amountCents,
    date,
    note: cleanText(value.note ?? value.reason),
  };
}

/** Normalise a list of credit applications, dropping half-formed ones. */
export function normalizeCreditApplicationList(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const app of list) {
    const clean = normalizeCreditApplication(app);
    if (clean) out.push(clean);
  }
  return out;
}

/** Credit already applied against one entry, in integer cents. */
export function appliedForEntry(applications, entryId) {
  return normalizeCreditApplicationList(applications)
    .filter((app) => app.creditEntryId === cleanText(entryId))
    .reduce((sum, app) => sum + app.amountCents, 0);
}

/** Credit remaining on one entry, in integer cents. */
export function remainingForEntry(entries, applications, entryId) {
  const entry = normalizeCreditEntryList(entries).find((item) => item.id === cleanText(entryId));
  if (!entry) return null;
  return entry.amountCents - appliedForEntry(applications, entryId);
}

/**
 * Record one operator application of credit to a bill. Returns the
 * new application list, or null when refused — unknown entry, an
 * entry belonging to another customer, no bill named, or an amount
 * above the entry's remaining credit — with the caller's list left
 * exactly unchanged. This is the ONLY way credit moves: there is
 * no automatic application anywhere in this module.
 */
export function applyCredit(entries, applications, application) {
  const clean = normalizeCreditApplication(application);
  if (!clean) return null;
  const entryList = normalizeCreditEntryList(entries);
  const entry = entryList.find((item) => item.id === clean.creditEntryId);
  if (!entry) return null;
  if (entry.customerId !== clean.customerId) return null;
  const remaining = entry.amountCents - appliedForEntry(applications, entry.id);
  if (clean.amountCents > remaining) return null;
  const base = normalizeCreditApplicationList(applications);
  const next = base.filter((app) => app.id !== clean.id);
  next.push(clean);
  return next;
}

/** Remove one application. Its credit simply becomes available again. */
export function removeCreditApplication(applications, id) {
  const cleanId = cleanText(id);
  if (cleanId === '') return null;
  return normalizeCreditApplicationList(applications).filter((app) => app.id !== cleanId);
}

/**
 * One customer's whole credit picture: credit in, credit applied,
 * and credit remaining, always summing exactly —
 * remaining = in − applied, in integer cents. Entries are oldest
 * first by date, undated last; applications follow their entries.
 */
export function creditBalanceForCustomer(entries, applications, customerId) {
  const cleanId = cleanText(customerId);
  const customerEntries = normalizeCreditEntryList(entries)
    .filter((item) => item.customerId === cleanId)
    .sort((a, b) => {
      if (a.date === '' && b.date === '') return 0;
      if (a.date === '') return 1;
      if (b.date === '') return -1;
      return a.date < b.date ? -1 : a.date > b.date ? 1 : 0;
    });
  const customerApps = normalizeCreditApplicationList(applications)
    .filter((app) => app.customerId === cleanId);
  const totalInCents = customerEntries.reduce((sum, item) => sum + item.amountCents, 0);
  const totalAppliedCents = customerApps.reduce((sum, app) => sum + app.amountCents, 0);
  const entriesWithRemaining = customerEntries.map((item) => ({
    ...item,
    appliedCents: appliedForEntry(customerApps, item.id),
    remainingCents: item.amountCents - appliedForEntry(customerApps, item.id),
  }));
  return {
    customerId: cleanId,
    totalInCents,
    totalAppliedCents,
    remainingCents: totalInCents - totalAppliedCents,
    entries: entriesWithRemaining,
    applications: customerApps,
  };
}

/** Credit entries for one customer, oldest first. */
export function creditEntriesForCustomer(entries, customerId) {
  return creditBalanceForCustomer(entries, [], customerId).entries;
}

export function creditSummaryText(balance) {
  if (!balance) return 'No credit record.';
  return `Credit in ${formatRs(balance.totalInCents)} · applied ${formatRs(balance.totalAppliedCents)} · remaining ${formatRs(balance.remainingCents)}.`;
}

export function creditHtml(balance) {
  if (!balance || balance.entries.length === 0) return '<p>No credit recorded for this customer.</p>';
  const rows = balance.entries.map((item) => {
    const apps = balance.applications.filter((app) => app.creditEntryId === item.id);
    const appText = apps.length === 0
      ? 'Not yet applied'
      : apps.map((app) => `${formatRs(app.amountCents)} → bill ${escapeHtml(app.billId)}`).join('; ');
    return `<tr><td>${escapeHtml(item.date || 'Undated')}</td><td>${escapeHtml(item.source)}</td><td>${formatRs(item.amountCents)}</td><td>${formatRs(item.appliedCents)}</td><td>${formatRs(item.remainingCents)}</td><td>${escapeHtml(appText)}</td></tr>`;
  }).join('');
  return `<table><thead><tr><th>Date</th><th>Source</th><th>Credit in</th><th>Applied</th><th>Remaining</th><th>Applied to</th></tr></thead><tbody>${rows}</tbody></table>`
    + `<p>${escapeHtml(creditSummaryText(balance))} Credit is applied only by a recorded application naming the bill; it is never converted to cash here.</p>`;
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function creditCsv(balance) {
  const lines = ['date,source,credit_in_cents,applied_cents,remaining_cents,applied_to_bill'];
  if (balance) {
    for (const item of balance.entries) {
      const bills = balance.applications
        .filter((app) => app.creditEntryId === item.id)
        .map((app) => app.billId)
        .join('; ');
      lines.push([item.date, item.source, item.amountCents, item.appliedCents, item.remainingCents, bills].map(csvCell).join(','));
    }
  }
  return lines.join('\n');
}

export function creditFilename() {
  return 'customer-credit-balance.csv';
}
