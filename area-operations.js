// Plan T — Area and mohalla operations: one shared area-filter rule and
// one area view, composed from the figures the source screens already
// derive. Nothing here changes a record, a calculation, or a zone-merging
// rule; it only assembles and filters what already exists.
//
// THE FILTER PROBLEM THIS PLAN FIXES
// Before Plan T, three screens filtered "area" three different ways:
//  - the Customers list dropdown (form-validation.js filterCustomersByArea)
//    grouped by canonicalMohalla key, so "Bani", "MOHALLA BANI" and
//    "BANII" are one area;
//  - the Customers list Area search field (customer-search-filter.js)
//    did the same canonical match, plus a partial label/stored fallback
//    for typed queries;
//  - Top Defaulters (dashboard-top-defaulters.js calculateTopDefaulters)
//    compared the raw saved `area` field exactly, so a customer whose
//    mohalla is "BANII" but whose area field says something else (or
//    nothing) vanished from an area-filtered defaulter list.
// The helpers below are now the single rule every screen uses:
// an area is identified by its canonicalMohalla key (phase3.js, PR #428 —
// untouched here), and a customer belongs to an area when the canonical
// key of (mohalla || area) equals that key. The two refactored call
// sites delegate to these helpers; their behaviour is unchanged except
// for the Top Defaulters fix, which is the point of the plan.
//
// FIGURE AGREEMENT
// buildAreaOperationsView derives its figures from the same fields the
// source screens read, on the same fixture:
//  - dues / billed / paid: allocation balanceDueCents and billAmountCents
//    via allocations.forMonth — the exact fields buildMohallaCardStats
//    (SISP-175) sums for the Mohalla dashboard card, including its
//    rules (archived excluded, free connections never owe, a null
//    balance contributes 0);
//  - defaulters: the same per-customer outstanding sum, ranked the same
//    way calculateTopDefaulters ranks (outstanding desc, oldest overdue
//    desc, customer number asc) with the same risk thresholds (>=3
//    unpaid months or >=60 days overdue = critical; >=2 or >=30 = high;
//    otherwise moderate) and the same due-date fallback (bill.dueDate
//    or the 5th of the bill month);
//  - promises: the customer record's promiseDate / promiseAmount with
//    waada-queue.js overdue days and age bands (Plan O bands);
//  - collections: non-voided bill payments dated in the selected month
//    (payment.voided === true excluded, Plan K rule), the same payment
//    records the register reads.
// Inputs are never mutated; every returned row is a fresh object.

import { canonicalMohalla, DEFAULT_MOHALLAS } from './phase3.js';
import { waadaOverdueDays, waadaAgeBand } from './waada-queue.js';
import { isVoidedPayment } from './payment-void-audit.js';

const normalizedText = (value) => String(value ?? '').normalize('NFKC').trim().toLocaleLowerCase();

const CANONICAL_KEYS = new Set(DEFAULT_MOHALLAS.map((name) => canonicalMohalla(name)?.key).filter(Boolean));

/** Canonical key for an area selection, or null for a blank selection. */
export function areaFilterKey(raw) {
  const canon = canonicalMohalla(raw ?? '');
  return canon ? canon.key : null;
}

/**
 * The resolved identity of an area selection: its canonical key, readable
 * label, owner-standard stored spelling, and whether it is one of the
 * owner's canonical mohallas. Null for a blank selection.
 */
export function resolveAreaFilter(raw) {
  const canon = canonicalMohalla(raw ?? '');
  if (!canon) return null;
  return { key: canon.key, label: canon.label, stored: canon.stored, canonical: CANONICAL_KEYS.has(canon.key) };
}

/** Canonical area key of a customer (or defaulter row) record, or null when it has no area set. */
export function customerAreaKey(customer) {
  if (!customer || typeof customer !== 'object') return null;
  return canonicalMohalla(customer.mohalla || customer.area || '')?.key ?? null;
}

/**
 * Exact area membership: blank / 'all' matches every customer; otherwise
 * the customer's canonical area key must equal the filter key. This is
 * the rule the Customers dropdown and the Top Defaulters area filter
 * now share.
 */
export function customerInArea(customer, areaKey) {
  if (!areaKey || areaKey === 'all') return true;
  return customerAreaKey(customer) === areaKey;
}

/**
 * Customers-list Area search semantics, extracted verbatim: a canonical
 * key match wins, and partial typing still finds a mohalla by its
 * readable label / canonical spelling. An empty query matches everyone.
 */
export function customerMatchesAreaFilter(customer, query) {
  const rawQuery = String(query ?? '').normalize('NFKC').trim();
  if (!rawQuery) return true;
  if (!customer || typeof customer !== 'object') return false;
  const customerMohalla = canonicalMohalla(customer.mohalla || customer.area || '');
  if (!customerMohalla) return false;
  const queryMohalla = canonicalMohalla(rawQuery);
  if (queryMohalla && customerMohalla.key === queryMohalla.key) return true;
  const needle = normalizedText(rawQuery);
  return normalizedText(customerMohalla.label).includes(needle)
    || normalizedText(customerMohalla.stored).includes(needle);
}

function calendarDaysBetween(laterYmd, earlierYmd) {
  const parse = (s) => {
    const [y, m, d] = String(s).split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((parse(laterYmd) - parse(earlierYmd)) / 86400000);
}

function defaulterRiskCategory(unpaidMonthsCount, oldestOverdueDays) {
  if (unpaidMonthsCount >= 3 || oldestOverdueDays >= 60) return 'critical';
  if (unpaidMonthsCount >= 2 || oldestOverdueDays >= 30) return 'high';
  return 'moderate';
}

/**
 * One area view: dues, defaulters, promises and collections for a single
 * area, for one month. `allocations` is a calculatePaymentAllocations
 * result (only forMonth is read). `todayStr` is 'YYYY-MM-DD' in PKT.
 * A blank area returns validArea: false with empty sections; an area
 * with no customers returns a valid, empty view (zeros, empty lists).
 */
export function buildAreaOperationsView({ customers, allocations, currentMonth, area, todayStr } = {}) {
  const empty = (extra) => ({
    validArea: false, area: null, month: String(currentMonth ?? ''),
    customerCount: 0, freeCount: 0, duesPKR: 0, billedCount: 0, paidCount: 0, paidPct: null,
    collectionsPKR: 0, collectionReceiptCount: 0, promiseCount: 0, promisedPKR: 0, defaulterCount: 0,
    defaulters: [], promises: [], ...extra,
  });
  const resolved = resolveAreaFilter(area);
  if (!resolved) return empty({ reason: 'Choose an area to open its operations view.' });
  const month = String(currentMonth ?? '');
  const today = String(todayStr ?? '').trim();
  const list = Array.isArray(customers) ? customers : [];
  const roster = list.filter((customer) => customer && !customer.archived && customerAreaKey(customer) === resolved.key);

  let freeCount = 0;
  let duesCents = 0;
  let billedCount = 0;
  let paidCount = 0;
  let collectionsPKR = 0;
  let collectionReceiptCount = 0;
  const defaulters = [];
  const promises = [];

  for (const customer of roster) {
    if (customer.isFreeConnection === true) {
      freeCount += 1;
      continue;
    }
    let outstandingCents = 0;
    const unpaidMonths = [];
    const bills = Array.isArray(customer.bills) ? customer.bills : [];
    for (const bill of bills) {
      const summary = allocations?.forMonth?.(customer.id, bill.month);
      const balance = summary?.balanceDueCents;
      if (typeof balance === 'number' && balance > 0) {
        outstandingCents += balance;
        const dueYmd = bill.dueDate || `${bill.month}-05`;
        unpaidMonths.push({
          month: bill.month,
          dueYmd,
          daysOverdue: today ? Math.max(0, calendarDaysBetween(today, dueYmd)) : 0,
          balanceDuePKR: Math.round(balance / 100),
        });
      }
      if (month && bill.month === month && summary && summary.billAmountCents !== null && summary.billAmountCents !== undefined) {
        billedCount += 1;
        if (balance === 0) paidCount += 1;
      }
      for (const payment of Array.isArray(bill.payments) ? bill.payments : []) {
        if (isVoidedPayment(payment)) continue;
        if (typeof payment?.date !== 'string' || payment.date.slice(0, 7) !== month) continue;
        const amount = Number(payment.amount);
        if (!Number.isFinite(amount)) continue;
        collectionsPKR += amount;
        collectionReceiptCount += 1;
      }
    }
    duesCents += outstandingCents;
    if (outstandingCents > 0) {
      unpaidMonths.sort((a, b) => a.month.localeCompare(b.month));
      const oldestOverdueDays = unpaidMonths.reduce((max, row) => Math.max(max, row.daysOverdue), 0);
      defaulters.push({
        id: customer.id,
        customerNumber: customer.customerNumber ?? null,
        name: customer.name || 'Unnamed Subscriber',
        phone: customer.phone || '',
        totalOutstandingPKR: Math.round(outstandingCents / 100),
        unpaidMonths,
        unpaidMonthsCount: unpaidMonths.length,
        oldestDueDate: unpaidMonths[0]?.dueYmd ?? null,
        oldestOverdueDays,
        riskCategory: defaulterRiskCategory(unpaidMonths.length, oldestOverdueDays),
      });
    }
  }
  defaulters.sort((a, b) =>
    b.totalOutstandingPKR - a.totalOutstandingPKR
    || b.oldestOverdueDays - a.oldestOverdueDays
    || (Number(a.customerNumber) || 0) - (Number(b.customerNumber) || 0));

  for (const customer of roster) {
    const promiseDate = typeof customer.promiseDate === 'string' ? customer.promiseDate.trim() : '';
    const overdueDays = waadaOverdueDays(promiseDate, today || undefined);
    if (overdueDays === null) continue;
    promises.push({
      id: customer.id,
      customerNumber: customer.customerNumber ?? null,
      name: customer.name || 'Unnamed Subscriber',
      phone: customer.phone || '',
      promiseDate,
      promiseAmount: customer.promiseAmount ?? null,
      promiseNote: customer.promiseNote ?? '',
      overdueDays,
      ageBand: waadaAgeBand(promiseDate, today || undefined),
      isOverdue: overdueDays > 0,
    });
  }
  promises.sort((a, b) =>
    b.overdueDays - a.overdueDays
    || a.promiseDate.localeCompare(b.promiseDate)
    || (Number(a.customerNumber) || 0) - (Number(b.customerNumber) || 0));

  const promisedPKR = promises.reduce((sum, row) => sum + (Number.isFinite(Number(row.promiseAmount)) ? Number(row.promiseAmount) : 0), 0);

  return {
    validArea: true,
    area: resolved,
    month,
    customerCount: roster.length,
    freeCount,
    duesPKR: Math.round(duesCents / 100),
    billedCount,
    paidCount,
    paidPct: billedCount > 0 ? Math.round((paidCount / billedCount) * 100) : null,
    collectionsPKR: Math.round(collectionsPKR),
    collectionReceiptCount,
    promiseCount: promises.length,
    promisedPKR: Math.round(promisedPKR),
    defaulterCount: defaulters.length,
    defaulters,
    promises,
    sources: 'Dues, billed and paid: allocation balanceDueCents / billAmountCents (same fields as the Mohalla card). '
      + 'Defaulters: same per-customer outstanding sum and ranking as Top Defaulters. '
      + 'Promises: customer promiseDate / promiseAmount with waada-queue overdue days and age bands. '
      + 'Collections: non-voided bill payments dated in the selected month. This view changes no record.',
  };
}

function escapeHtml(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Read-only HTML rendering of an area view for the app dialog. All values are escaped. */
export function areaOperationsViewHtml(view) {
  if (!view || !view.validArea) {
    return `<p>${escapeHtml(view?.reason || 'Choose an area to open its operations view.')}</p>`;
  }
  const paidText = view.paidPct === null ? '—' : `${view.paidPct}%`;
  const defaulterLines = view.defaulters.length
    ? view.defaulters.map((row) => `<p><span>${escapeHtml(row.name)}${row.customerNumber !== null ? ` #${escapeHtml(row.customerNumber)}` : ''} · ${escapeHtml(row.unpaidMonthsCount)} unpaid month${row.unpaidMonthsCount === 1 ? '' : 's'} · ${escapeHtml(row.riskCategory)}</span><strong>${escapeHtml(row.totalOutstandingPKR)} PKR</strong></p>`).join('')
    : '<p><span>No defaulters in this area.</span></p>';
  const promiseLines = view.promises.length
    ? view.promises.map((row) => `<p><span>${escapeHtml(row.name)}${row.customerNumber !== null ? ` #${escapeHtml(row.customerNumber)}` : ''} · promise ${escapeHtml(row.promiseDate)}${row.isOverdue ? ` · ${row.overdueDays} days overdue${row.ageBand ? ` (${row.ageBand})` : ''}` : ' · not yet due'}</span><strong>${row.promiseAmount !== null ? `${escapeHtml(row.promiseAmount)} PKR` : '—'}</strong></p>`).join('')
    : '<p><span>No promises recorded in this area.</span></p>';
  return `<article class="owner-month-report-section"><h3>${escapeHtml(view.area.stored)} — ${escapeHtml(view.month)}</h3>`
    + `<p><span>Customers</span><strong>${view.customerCount}${view.freeCount > 0 ? ` (${view.freeCount} free)` : ''}</strong></p>`
    + `<p><span>Total dues</span><strong>${view.duesPKR} PKR</strong></p>`
    + `<p><span>This month billed / paid</span><strong>${view.billedCount} / ${view.paidCount} (${paidText})</strong></p>`
    + `<p><span>Collections this month</span><strong>${view.collectionsPKR} PKR · ${view.collectionReceiptCount} receipts</strong></p>`
    + `<p><span>Promises</span><strong>${view.promiseCount} · ${view.promisedPKR} PKR promised</strong></p></article>`
    + `<article class="owner-month-report-section"><h3>Defaulters</h3>${defaulterLines}</article>`
    + `<article class="owner-month-report-section"><h3>Promises (Waada)</h3>${promiseLines}</article>`
    + `<p class="owner-month-report-footnote">${escapeHtml(view.sources)}</p>`;
}
