/**
 * upstream-providers.js — Hisaab Clearly Visible (H1): upstream bandwidth
 * provider register.
 *
 * Problem: 18 months of Nayatel bills (Rs. 502,820) lived only in the
 * operator's PDF. A Nayatel bill was only an expense row with the string
 * category 'Nayatel bill' — no provider record, no bill history per
 * provider, no since-date, no pending-bill flag, no run-rate, no
 * total-paid-per-provider. The dashboard could not answer "Nayatel ko kul
 * kitna diya, kab se, haali bill kitna, agla bill baqi hai ya nahi".
 *
 * What this module is:
 * - One separate register (localStorage key sisp_upstream_providers_v1,
 *   following the sisp_*_v1 convention): providers, each with dated bills
 *   (payment date, cash basis) and an optional pending bill. Pure load /
 *   save / normalise plus pure derivations (totals, since, run-rate,
 *   per-month summaries). No stored totals anywhere — every number is
 *   derived live from the bills, so two screens can never disagree.
 * - Seed (migration style, NOT first-run-gated — existing installs are
 *   not fresh): on first read, when the key is absent, the register is
 *   seeded with the Nayatel history from the operator's PDF and saved.
 *   A second load reads the stored seed and does NOT re-seed.
 * - History-only seed (design T3): every seed row is seeded:true,
 *   mirrored:false and NO expense row is written for any seed row, so
 *   past months' P&L and partner shares are never restated. New bills
 *   added later (H2) are mirrored into the expense ledger by the
 *   single-write mirror; the seed is read-only history.
 *
 * HARD RULE (by construction): the model has NO account-ID field at all
 * — there is nowhere to put a bill ID or NTL number, so it cannot leak.
 * The sanitizer whitelists fields, so an account ID smuggled into a
 * backup is dropped on restore. The PDF itself never enters the repo.
 *
 * Gaps are not zeros (design T4): a month with no bill returns no
 * record (providerMonthSummary returns null), and an unknown-amount
 * bill (amount null) is excluded from every sum and counted separately
 * — never Rs. 0.
 *
 * Cash basis (design T5): grouping is by payment date everywhere. The
 * billMonth note (which bill a payment covers) never drives a total.
 *
 * This module imports nothing. core.js imports the sanitizer from here
 * for backup/restore — the reverse would be a module cycle.
 * Tests use synthetic data only.
 */

export const UPSTREAM_PROVIDERS_KEY = 'sisp_upstream_providers_v1';

/** Provider names come from this fixed list — never typed free-text — so names stay canonical for grouping. */
export const UPSTREAM_PROVIDER_NAMES = Object.freeze([
  'Nayatel',
  'PTCL',
  'Transworld',
  'Wateen',
  'Telenor',
  'Jazz',
  'Other',
]);

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

const makeId = () => globalThis.crypto?.randomUUID?.() ?? `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const cleanText = value => (typeof value === 'string' ? value.trim() : '');
const validAmount = value => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.round(number * 100) / 100 : null;
};
const validDate = value => {
  if (typeof value !== 'string' || !DATE_RE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};
const slug = name => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'provider';

/**
 * Seed bills, transcribed from the operator's Nayatel payment history
 * (May 2025 – Oct 2026). [date, amount (Rs), billMonth, note].
 * Total of the known amounts: Rs. 502,820 (re-summed and verified).
 * The 12 May 2026 payment has amount null — confirmed by email, no
 * amount stated — and is excluded from every sum. Jun 2026 has no row.
 * No bill ID or account number is recorded here, by design.
 */
const SEED_BILLS = [
  ['2025-05-05', 30892, '2025-05', ''],
  ['2025-06-10', 157, '2025-06', ''],
  ['2025-06-10', 8500, '2025-06', ''],
  ['2025-07-01', 3392, '2025-07', ''],
  ['2025-08-01', 5750, '2025-08', ''],
  ['2025-09-10', 4698, '2025-09', ''],
  ['2025-10-09', 5573, '2025-10', ''],
  ['2025-11-09', 5503, '2025-11', ''],
  ['2025-12-09', 15346, '2025-12', ''],
  ['2026-01-08', 29967, '2026-01', ''],
  ['2026-02-04', 1000, '2026-02', ''],
  ['2026-02-08', 3000, '2026-02', ''],
  ['2026-02-08', 1076, '2026-02', ''],
  ['2026-02-09', 22300, '2026-02', ''],
  ['2026-03-09', 26002, '2026-03', ''],
  ['2026-04-30', 58331, '2026-04', 'Covers May bill'],
  ['2026-04-30', 39608, '2026-04', 'Credit applied, May bill'],
  ['2026-05-12', null, '2026-05', 'raqam maloom nahi'],
  ['2026-07-31', 60000, '2026-07', 'Aug bill'],
  ['2026-08-31', 60575, '2026-08', 'Sep bill'],
  ['2026-09-30', 60575, '2026-09', 'Oct bill'],
  ['2026-10-31', 60575, '2026-10', 'Nov bill'],
];

export const SEED_PROVIDER_ID = 'prov-nayatel';
export const SEED_TOTAL_PAID = 502820;
export const SEED_SINCE = '2025-05-05';

/** The seeded register: one provider, Nayatel, history-only. A fresh object on every call. */
export function seedUpstreamProviders() {
  return {
    providers: [{
      id: SEED_PROVIDER_ID,
      name: 'Nayatel',
      active: true,
      bills: SEED_BILLS.map(([date, amount, billMonth, note]) => ({
        id: `pb-${makeId()}`,
        date,
        amount,
        billMonth,
        method: '',
        note,
        seeded: true,
        mirrored: false,
      })),
      pendingBill: { month: '2026-11', amount: 60575, issuedDate: '2026-11-01' },
    }],
  };
}

function sanitizeBill(bill) {
  if (!bill || typeof bill !== 'object') return null;
  if (!validDate(bill.date)) return null;
  let amount = null;
  if (bill.amount !== null && bill.amount !== undefined && bill.amount !== '') {
    amount = validAmount(bill.amount);
    if (amount === null) return null;
  }
  const billMonth = typeof bill.billMonth === 'string' && MONTH_RE.test(bill.billMonth) ? bill.billMonth : '';
  return {
    id: typeof bill.id === 'string' && bill.id.trim() ? bill.id.trim() : `pb-${makeId()}`,
    date: bill.date,
    amount,
    billMonth,
    method: cleanText(bill.method).slice(0, 50),
    note: cleanText(bill.note).slice(0, 100),
    seeded: bill.seeded === true,
    mirrored: bill.mirrored === true,
  };
}

function sanitizePendingBill(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  if (typeof value.month !== 'string' || !MONTH_RE.test(value.month)) return null;
  const amount = validAmount(value.amount);
  if (amount === null) return null;
  if (!validDate(value.issuedDate)) return null;
  return { month: value.month, amount, issuedDate: value.issuedDate };
}

function sanitizeProviderRow(row) {
  if (!row || typeof row !== 'object') return null;
  const name = cleanText(row.name);
  if (!UPSTREAM_PROVIDER_NAMES.includes(name)) return null;
  const bills = [];
  const seenBillIds = new Set();
  if (Array.isArray(row.bills)) {
    for (const bill of row.bills) {
      const cleaned = sanitizeBill(bill);
      if (!cleaned) continue;
      if (seenBillIds.has(cleaned.id)) continue;
      seenBillIds.add(cleaned.id);
      bills.push(cleaned);
    }
  }
  return {
    id: typeof row.id === 'string' && row.id.trim() ? row.id.trim() : `prov-${slug(name)}`,
    name,
    active: row.active === false ? false : true,
    bills,
    pendingBill: sanitizePendingBill(row.pendingBill),
  };
}

/**
 * Clean a stored { providers: [...] } object; unknown/invalid rows are
 * dropped. Only whitelisted fields survive — an account ID, NTL number
 * or any other extra field is dropped here, so it can never land in the
 * register through a backup or a hand-edited key.
 */
export function sanitizeUpstreamProviders(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { providers: [] };
  if (!Array.isArray(value.providers)) return { providers: [] };
  const providers = [];
  const seenProviderIds = new Set();
  for (const row of value.providers) {
    const cleaned = sanitizeProviderRow(row);
    if (!cleaned) continue;
    if (seenProviderIds.has(cleaned.id)) continue;
    seenProviderIds.add(cleaned.id);
    providers.push(cleaned);
  }
  return { providers };
}

export function loadUpstreamProviders() {
  try {
    if (typeof localStorage === 'undefined') return { providers: [] };
    const raw = localStorage.getItem(UPSTREAM_PROVIDERS_KEY);
    if (raw === null || raw === undefined) {
      const seeded = seedUpstreamProviders();
      try {
        localStorage.setItem(UPSTREAM_PROVIDERS_KEY, JSON.stringify(seeded));
      } catch { /* storage unavailable — the caller still gets the seed in memory */ }
      return seeded;
    }
    if (!raw) return { providers: [] };
    return sanitizeUpstreamProviders(JSON.parse(raw));
  } catch {
    return { providers: [] };
  }
}

export function saveUpstreamProviders(data) {
  const cleaned = sanitizeUpstreamProviders(data);
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(UPSTREAM_PROVIDERS_KEY, JSON.stringify(cleaned));
  } catch { /* storage unavailable — the caller still gets the cleaned data back */ }
  return cleaned;
}

export function providerById(data, id) {
  const cleaned = sanitizeUpstreamProviders(data);
  return cleaned.providers.find(provider => provider.id === id) ?? null;
}

export function providerByName(data, name) {
  const cleaned = sanitizeUpstreamProviders(data);
  return cleaned.providers.find(provider => provider.name === name) ?? null;
}

/** Totals over a provider's bills. Unknown-amount bills are excluded and counted, never treated as Rs. 0. */
export function providerBillTotals(provider) {
  const cleaned = sanitizeProviderRow(provider);
  const bills = cleaned ? cleaned.bills : [];
  let total = 0;
  let knownCount = 0;
  let unknownCount = 0;
  for (const bill of bills) {
    if (typeof bill.amount === 'number' && Number.isFinite(bill.amount)) {
      total += bill.amount;
      knownCount++;
    } else {
      unknownCount++;
    }
  }
  return { total: Math.round(total * 100) / 100, knownCount, unknownCount, billCount: bills.length };
}

/** Since is auto-derived: the oldest bill date. Null when the provider has no bills. */
export function providerSince(provider) {
  const cleaned = sanitizeProviderRow(provider);
  if (!cleaned) return null;
  let since = null;
  for (const bill of cleaned.bills) {
    if (since === null || bill.date < since) since = bill.date;
  }
  return since;
}

/** Bills dated in a month ('YYYY-MM'). Empty array — never a zero — when the month has no record. */
export function providerBillsForMonth(provider, month) {
  const cleaned = sanitizeProviderRow(provider);
  if (!cleaned || typeof month !== 'string' || !MONTH_RE.test(month)) return [];
  return cleaned.bills.filter(bill => bill.date.slice(0, 7) === month);
}

/**
 * One month's summary, or null when the month has no bill at all
 * ("koi record nahi"). total is null when the month's bills all have
 * unknown amounts ("raqam maloom nahi") — never Rs. 0.
 */
export function providerMonthSummary(provider, month) {
  const bills = providerBillsForMonth(provider, month);
  if (!bills.length) return null;
  let total = 0;
  let knownCount = 0;
  let unknownCount = 0;
  for (const bill of bills) {
    if (typeof bill.amount === 'number' && Number.isFinite(bill.amount)) {
      total += bill.amount;
      knownCount++;
    } else {
      unknownCount++;
    }
  }
  return {
    total: knownCount ? Math.round(total * 100) / 100 : null,
    knownCount,
    unknownCount,
    billCount: bills.length,
  };
}

/**
 * Run-rate over known-amount bills only: the last bill (amount + date)
 * plus the average of the last 3 dated bills with known amounts. When
 * fewer than 3 known bills exist the average covers what exists and
 * lastThreeCount says so; with none, everything is null.
 */
export function providerRunRate(provider) {
  const cleaned = sanitizeProviderRow(provider);
  if (!cleaned) return { lastBill: null, lastThreeAverage: null, lastThreeCount: 0 };
  const known = cleaned.bills
    .filter(bill => typeof bill.amount === 'number' && Number.isFinite(bill.amount))
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  if (!known.length) return { lastBill: null, lastThreeAverage: null, lastThreeCount: 0 };
  const lastThree = known.slice(0, 3);
  const sum = lastThree.reduce((acc, bill) => acc + bill.amount, 0);
  return {
    lastBill: { date: lastThree[0].date, amount: lastThree[0].amount },
    lastThreeAverage: Math.round((sum / lastThree.length) * 100) / 100,
    lastThreeCount: lastThree.length,
  };
}

/** One bundled summary for a provider card: totals + since + run-rate + pending bill. Null for an invalid provider. */
export function summarizeProvider(provider) {
  const cleaned = sanitizeProviderRow(provider);
  if (!cleaned) return null;
  const totals = providerBillTotals(cleaned);
  const runRate = providerRunRate(cleaned);
  return {
    id: cleaned.id,
    name: cleaned.name,
    active: cleaned.active,
    total: totals.total,
    knownCount: totals.knownCount,
    unknownCount: totals.unknownCount,
    billCount: totals.billCount,
    since: providerSince(cleaned),
    lastBill: runRate.lastBill,
    lastThreeAverage: runRate.lastThreeAverage,
    lastThreeCount: runRate.lastThreeCount,
    pendingBill: cleaned.pendingBill,
  };
}

// ---------------------------------------------------------------------------
// Hisaab Clearly Visible (H2): single-write mirror (design §2.5).
//
// Adding a bill in the Upstream tab writes BOTH records in one call: one
// provider-register row and one expense-ledger row, linked by
// `providerBillId` on the expense row. Edit/delete of a provider bill
// goes through the same path and edits/deletes both rows. Dedupe is by
// providerBillId (the roznamcha/supplier sync precedent, SISP-45/56/107):
// a re-save never creates a second expense row.
//
// The mirror builds the expense row directly (roznamcha precedent,
// roznamcha.js syncedRoznamchaExpenseRow) and NEVER goes through
// addExpense — addExpense builds a fresh object from a fixed field list
// and silently drops providerBillId. New bills only: seed rows
// (seeded:true) are never mirrored, so past P&L and partner shares are
// never restated (design T3). A null-amount bill is refused (D6(a)) —
// requireAmount already forbids < 0.01 on the expense side, so a bill
// with an unknown amount can never become an expense row.
// ---------------------------------------------------------------------------

/** Expense category a provider bill mirrors into (design §2.3 / D4(a)). The frozen EXPENSE_CATEGORIES list is NOT extended. */
export function providerBillExpenseCategory(name) {
  return name === 'Nayatel' ? 'Nayatel bill' : 'Other expenses';
}

/** Notes text for a mirrored expense row. Non-Nayatel rows carry the provider name so the ledger stays readable. */
export function providerBillExpenseNotes(name, note) {
  const cleanNote = cleanText(note);
  if (name === 'Nayatel') return cleanNote;
  return cleanNote ? `Upstream: ${name} — ${cleanNote}` : `Upstream: ${name}`;
}

/** Deterministic expense id for a mirrored bill (roznamcha precedent: roz-<id>). One bill id maps to exactly one expense row. */
export function syncedUpstreamExpenseId(billId) {
  return `upb-${billId}`;
}

/** True when an expense row was written by the Upstream-tab mirror. */
export function isUpstreamMirrorExpense(row) {
  return !!row && typeof row === 'object' && typeof row.providerBillId === 'string' && row.providerBillId !== '';
}

function mirrorExpenseRow(bill, providerName, existing, referenceDate = new Date()) {
  const fields = {
    date: bill.date,
    amount: bill.amount,
    category: providerBillExpenseCategory(providerName),
    notes: providerBillExpenseNotes(providerName, bill.note),
    area: '',
    providerBillId: bill.id,
  };
  if (!existing) {
    return { id: syncedUpstreamExpenseId(bill.id), ...fields, createdAt: new Date(referenceDate).toISOString() };
  }
  const drifted = existing.date !== fields.date || existing.amount !== fields.amount
    || existing.category !== fields.category || existing.notes !== fields.notes
    || existing.providerBillId !== bill.id;
  return drifted ? { ...existing, ...fields, updatedAt: new Date(referenceDate).toISOString() } : existing;
}

function findProviderBill(providersData, billId) {
  const cleaned = sanitizeUpstreamProviders(providersData);
  for (const provider of cleaned.providers) {
    const bill = provider.bills.find(row => row.id === billId);
    if (bill) return { providers: cleaned, provider, bill };
  }
  return { providers: cleaned, provider: null, bill: null };
}

function withUpdatedBill(providers, providerId, billId, nextBill) {
  return {
    providers: providers.providers.map(provider => (provider.id === providerId
      ? { ...provider, bills: provider.bills.map(bill => (bill.id === billId ? nextBill : bill)) }
      : provider)),
  };
}

/**
 * Add a provider by fixed-list name (never free-text). Returns the
 * existing provider when the name is already registered. Pure.
 */
export function addUpstreamProvider(providersData, name) {
  const cleaned = sanitizeUpstreamProviders(providersData);
  const cleanName = cleanText(name);
  if (!UPSTREAM_PROVIDER_NAMES.includes(cleanName)) throw new Error('Choose an upstream provider from the list.');
  const existing = cleaned.providers.find(provider => provider.name === cleanName);
  if (existing) return { providers: cleaned, provider: existing, added: false };
  const provider = { id: `prov-${slug(cleanName)}`, name: cleanName, active: true, bills: [], pendingBill: null };
  return { providers: { providers: [...cleaned.providers, provider] }, provider, added: true };
}

/**
 * Create a new (unmirrored) provider bill. Throws on a missing provider,
 * an invalid date, or a null/unknown amount — a bill with an unknown
 * amount cannot be mirrored into the expense ledger (D6(a)). Pure.
 */
export function createProviderBill(providersData, fields) {
  const cleaned = sanitizeUpstreamProviders(providersData);
  const provider = cleaned.providers.find(row => row.id === fields?.providerId) ?? null;
  if (!provider) throw new Error('Choose an upstream provider first.');
  const amount = validAmount(fields?.amount);
  if (amount === null) throw new Error('Enter the amount paid for this bill (PKR). A bill with an unknown amount cannot be mirrored into the expense ledger.');
  if (!validDate(fields?.date)) throw new Error('Enter a valid payment date (PKT).');
  const billMonth = typeof fields?.billMonth === 'string' && MONTH_RE.test(fields.billMonth) ? fields.billMonth : '';
  const bill = {
    id: `pb-${makeId()}`,
    date: fields.date,
    amount,
    billMonth,
    method: cleanText(fields?.method).slice(0, 50),
    note: cleanText(fields?.note).slice(0, 100),
    seeded: false,
    mirrored: false,
  };
  const providers = {
    providers: cleaned.providers.map(row => (row.id === provider.id
      ? { ...row, bills: [...row.bills, bill] }
      : row)),
  };
  return { providers, bill };
}

/**
 * Mirror one EXISTING provider bill into the expense ledger. A re-save
 * is a no-op (added:false, same row, same bill) — dedupe by
 * providerBillId. A seeded bill is never mirrored (added:false, reason
 * 'seeded'). A null-amount bill throws (D6(a)). Pure.
 */
export function mirrorProviderBill(providersData, expenses, billId, referenceDate = new Date()) {
  const { providers, provider, bill } = findProviderBill(providersData, billId);
  if (!bill) throw new Error('Unknown provider bill.');
  const rows = Array.isArray(expenses) ? expenses : [];
  if (bill.seeded) return { providers, expenses: rows, bill, expense: null, added: false, reason: 'seeded' };
  if (bill.amount === null || bill.amount === undefined) throw new Error('This bill has no known amount, so it cannot be mirrored into the expense ledger.');
  const existing = rows.find(row => isUpstreamMirrorExpense(row) && row.providerBillId === bill.id) ?? null;
  if (existing) return { providers, expenses: rows, bill, expense: existing, added: false };
  const expense = mirrorExpenseRow(bill, provider.name, null, referenceDate);
  const nextBill = { ...bill, mirrored: true };
  return {
    providers: withUpdatedBill(providers, provider.id, bill.id, nextBill),
    expenses: [...rows, expense],
    bill: nextBill,
    expense,
    added: true,
  };
}

/**
 * Add a bill AND mirror it in one call: the Upstream tab's single-write
 * path. Returns { providers, expenses, bill, expense, added:true }.
 * The bill comes back with mirrored:true. Pure.
 */
export function addProviderBillMirror(providersData, expenses, fields, referenceDate = new Date()) {
  const created = createProviderBill(providersData, fields);
  return mirrorProviderBill(created.providers, expenses, created.bill.id, referenceDate);
}

/**
 * Edit a provider bill through the mirror path: the provider row AND its
 * linked expense row are updated in place (same bill id, same expense
 * id). Missing fields keep their previous value. Seed history cannot be
 * edited — add a correction bill instead. A null amount throws (D6(a)).
 * When the linked expense row is missing (never mirrored), one is
 * written. Pure.
 */
export function editProviderBillMirror(providersData, expenses, billId, fields, referenceDate = new Date()) {
  const { providers, provider, bill } = findProviderBill(providersData, billId);
  if (!bill) throw new Error('Unknown provider bill.');
  if (bill.seeded) throw new Error('Seed history cannot be edited — add a correction bill instead.');
  const amount = fields?.amount === undefined ? bill.amount : validAmount(fields.amount);
  if (amount === null) throw new Error('Enter the amount paid for this bill (PKR). A bill with an unknown amount cannot be mirrored into the expense ledger.');
  const date = fields?.date === undefined ? bill.date : fields.date;
  if (!validDate(date)) throw new Error('Enter a valid payment date (PKT).');
  const nextBill = {
    ...bill,
    date,
    amount,
    billMonth: typeof fields?.billMonth === 'string' && MONTH_RE.test(fields.billMonth) ? fields.billMonth : bill.billMonth,
    method: fields?.method !== undefined ? cleanText(fields.method).slice(0, 50) : bill.method,
    note: fields?.note !== undefined ? cleanText(fields.note).slice(0, 100) : bill.note,
    mirrored: true,
  };
  const rows = Array.isArray(expenses) ? expenses : [];
  const existing = rows.find(row => isUpstreamMirrorExpense(row) && row.providerBillId === bill.id) ?? null;
  const expense = mirrorExpenseRow(nextBill, provider.name, existing, referenceDate);
  const nextExpenses = existing
    ? rows.map(row => (row.id === existing.id ? expense : row))
    : [...rows, expense];
  return {
    providers: withUpdatedBill(providers, provider.id, bill.id, nextBill),
    expenses: nextExpenses,
    bill: nextBill,
    expense,
  };
}

/**
 * Delete a provider bill through the mirror path: the provider row AND
 * its linked expense row are both removed; other bills' rows are
 * untouched. Seed history cannot be deleted — add a correction bill
 * instead. Pure.
 */
export function deleteProviderBillMirror(providersData, expenses, billId) {
  const { providers, provider, bill } = findProviderBill(providersData, billId);
  if (!bill) throw new Error('Unknown provider bill.');
  if (bill.seeded) throw new Error('Seed history cannot be deleted — add a correction bill instead.');
  const nextProviders = {
    providers: providers.providers.map(row => (row.id === provider.id
      ? { ...row, bills: row.bills.filter(item => item.id !== bill.id) }
      : row)),
  };
  const rows = Array.isArray(expenses) ? expenses : [];
  return {
    providers: nextProviders,
    expenses: rows.filter(row => !(isUpstreamMirrorExpense(row) && row.providerBillId === bill.id)),
    deleted: true,
  };
}

/**
 * Set (or clear, with null) a provider's pending bill — display-only
 * (design D7(a)): it writes no expense row and touches neither the
 * overhead banner nor the month-end wizard. Pure.
 */
export function setProviderPendingBill(providersData, providerId, pendingBill) {
  const cleaned = sanitizeUpstreamProviders(providersData);
  const provider = cleaned.providers.find(row => row.id === providerId) ?? null;
  if (!provider) throw new Error('Unknown upstream provider.');
  let next = null;
  if (pendingBill !== null && pendingBill !== undefined) {
    next = sanitizePendingBill(pendingBill);
    if (!next) throw new Error('Enter a valid pending bill: month (YYYY-MM), amount paid (PKR) and issued date.');
  }
  const providers = {
    providers: cleaned.providers.map(row => (row.id === provider.id
      ? { ...row, pendingBill: next }
      : row)),
  };
  return { providers, provider: { ...provider, pendingBill: next } };
}
