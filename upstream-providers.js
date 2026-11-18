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
