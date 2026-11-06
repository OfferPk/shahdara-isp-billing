// Profile polish #8 — Wada dashboard: every wada, counted.
//
// The polish #5 wada record store already holds each promise with
// an explicit outcome (kept on time, kept late, broken, still open)
// and counts a customer's health in plain words with no scores and
// no percentages. This module is the one place where points and
// percentages live: it reads that store only and adds the dashboard
// on top — totals, a pie chart, per-customer points, and a search.
//
// Points (the user's own rules, 2026-11-06): every completed wada
// is +5 points, whether kept on time or kept late, and every broken
// wada is −5 points. A customer whose points reach 100 or more is
// Trusted and shows green. Below 100 the customer shows red, with
// the chance of keeping a wada written out from history: kept
// wadas divided by all closed wadas, as a whole percent. A customer
// with no closed wada yet has no history to rate, so no chance is
// shown for them. Twenty net kept wadas reach the 100-point mark.
//
// The pie chart slices are kept on time, kept late, broken, and
// still open, in that fixed order, and their whole-percent shares
// always add to 100 (largest-remainder rounding). The chart itself
// is a plain CSS conic gradient — this app is offline with no chart
// library, so nothing is fetched and nothing is drawn by script.
//
// This module never reads or writes the single live promise on the
// customer record, the amount-required promise history, or the
// service-promise trackers, and it never changes any wada, bill,
// payment, or customer record by itself: it only reads the wada
// list the caller supplies. It is pure and import-free: the caller
// supplies every record, and the module never reads storage, the
// clock, or the network, and never mutates an input. Dates are
// strict YYYY-MM-DD strings checked against the real calendar by
// integer arithmetic, so no clock object is ever used.

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/** Points for one completed wada (kept on time or kept late). */
export const WADA_DASHBOARD_POINTS_KEPT = 5;
/** Points for one broken wada. */
export const WADA_DASHBOARD_POINTS_BROKEN = -5;
/** Points at or above which a customer reads as Trusted. */
export const WADA_DASHBOARD_TRUSTED_POINTS = 100;

/** Pie slices in fixed order: key, label, and chart colour. */
export const WADA_DASHBOARD_SLICES = Object.freeze([
  { key: 'kept', label: 'Kept on time', color: '#16a34a' },
  { key: 'keptLate', label: 'Kept late', color: '#d97706' },
  { key: 'broken', label: 'Broken', color: '#dc2626' },
  { key: 'pending', label: 'Still open', color: '#94a3b8' }
]);

function isLeapYear(year) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

/** Strict YYYY-MM-DD validation against the real calendar (leap-aware). */
function isStrictWadaDashboardDate(value) {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12) return false;
  let limit = DAYS_IN_MONTH[month - 1];
  if (month === 2 && isLeapYear(year)) limit = 29;
  return day >= 1 && day <= limit;
}

function cleanText(value) {
  return String(value ?? '').trim();
}

function cleanKey(value) {
  return cleanText(value).toLowerCase();
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function cleanWadaDashboardStatus(value) {
  const status = cleanText(value);
  if (status === 'kept') return 'kept';
  if (status === 'keptLate') return 'keptLate';
  if (status === 'broken') return 'broken';
  if (status === 'pending') return 'pending';
  return null;
}

/**
 * The dashboard counts only well-formed wadas: an id, a customer,
 * a strict promised date, and one of the four known outcomes. A
 * record with an unknown outcome is not a counted wada — it is
 * left out rather than guessed as open.
 */
function normalizeWadaDashboardRecord(record) {
  if (!record || typeof record !== 'object') return null;
  const id = cleanText(record.id);
  const customer = cleanText(record.customer);
  const promisedDate = cleanText(record.promisedDate);
  if (!id || !customer || !isStrictWadaDashboardDate(promisedDate)) return null;
  const status = cleanWadaDashboardStatus(record.status);
  if (!status) return null;
  return { id, customer, promisedDate, status };
}

export function normalizeWadaDashboardList(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const item of list) {
    const record = normalizeWadaDashboardRecord(item);
    if (!record || seen.has(record.id)) continue;
    seen.add(record.id);
    out.push(record);
  }
  return out;
}

/**
 * Whole-percent shares that always add to 100 (largest-remainder
 * rounding, ties broken by slice order). All zeros when nothing
 * is counted.
 */
function reconciledShares(counts, total) {
  if (total <= 0) return counts.map(() => 0);
  const exact = counts.map((count) => (count * 100) / total);
  const shares = exact.map((share) => Math.floor(share));
  let remainder = 100 - shares.reduce((sum, share) => sum + share, 0);
  const order = exact
    .map((share, index) => ({ index, frac: share - Math.floor(share) }))
    .sort((a, b) => b.frac - a.frac || a.index - b.index);
  for (let k = 0; k < remainder; k += 1) {
    shares[order[k % order.length].index] += 1;
  }
  return shares;
}

/** Counts of one customer's wadas, by outcome. */
function countsForCustomer(records) {
  const counts = { kept: 0, keptLate: 0, broken: 0, pending: 0, total: records.length };
  for (const record of records) {
    if (record.status === 'kept') counts.kept += 1;
    else if (record.status === 'keptLate') counts.keptLate += 1;
    else if (record.status === 'broken') counts.broken += 1;
    else counts.pending += 1;
  }
  return counts;
}

/**
 * Points for one customer's counts: +5 per completed wada (kept
 * on time or kept late), −5 per broken wada, nothing for a wada
 * that is still open.
 */
export function wadaDashboardPointsForCounts(counts) {
  const kept = (counts.kept || 0) + (counts.keptLate || 0);
  const broken = counts.broken || 0;
  return WADA_DASHBOARD_POINTS_KEPT * kept + WADA_DASHBOARD_POINTS_BROKEN * broken;
}

/**
 * Chance of keeping a wada, from history: completed wadas over
 * all closed wadas, as a whole percent. Null when the customer
 * has no closed wada yet — no history, no chance to show.
 */
export function wadaDashboardChanceForCounts(counts) {
  const kept = (counts.kept || 0) + (counts.keptLate || 0);
  const closed = kept + (counts.broken || 0);
  if (closed === 0) return null;
  return Math.round((100 * kept) / closed);
}

/** Totals across every counted wada, with reconciled shares. */
export function wadaDashboardTotals(list) {
  const records = normalizeWadaDashboardList(list);
  const counts = countsForCustomer(records);
  const customers = new Set(records.map((record) => cleanKey(record.customer))).size;
  const shares = reconciledShares(
    [counts.kept, counts.keptLate, counts.broken, counts.pending],
    counts.total
  );
  return {
    customers,
    total: counts.total,
    kept: counts.kept,
    keptLate: counts.keptLate,
    broken: counts.broken,
    pending: counts.pending,
    keptShare: shares[0],
    keptLateShare: shares[1],
    brokenShare: shares[2],
    pendingShare: shares[3],
    keptPercent: shares[0] + shares[1],
    brokenPercent: shares[2]
  };
}

/** Pie slices in fixed order, with counts and reconciled shares. */
export function wadaDashboardPie(list) {
  const totals = wadaDashboardTotals(list);
  const shares = [totals.keptShare, totals.keptLateShare, totals.brokenShare, totals.pendingShare];
  const counts = [totals.kept, totals.keptLate, totals.broken, totals.pending];
  return WADA_DASHBOARD_SLICES.map((slice, index) => ({
    key: slice.key,
    label: slice.label,
    color: slice.color,
    count: counts[index],
    share: shares[index]
  }));
}

/** One customer's dashboard figures: counts, points, trust, chance. */
export function wadaDashboardCustomerStats(list, customerId) {
  const wanted = cleanKey(customerId);
  const records = wanted
    ? normalizeWadaDashboardList(list).filter((record) => cleanKey(record.customer) === wanted)
    : [];
  const counts = countsForCustomer(records);
  const points = wadaDashboardPointsForCounts(counts);
  return {
    customer: cleanText(customerId),
    kept: counts.kept,
    keptLate: counts.keptLate,
    broken: counts.broken,
    pending: counts.pending,
    total: counts.total,
    points,
    trusted: points >= WADA_DASHBOARD_TRUSTED_POINTS,
    chancePercent: wadaDashboardChanceForCounts(counts)
  };
}

function displayNameFor(customers, customerKey) {
  const wanted = cleanKey(customerKey);
  if (!wanted || !Array.isArray(customers)) return cleanText(customerKey);
  const found = customers.find((entry) => entry && cleanKey(entry.id) === wanted);
  const name = found ? cleanText(found.name) : '';
  return name || cleanText(customerKey);
}

/**
 * One row per customer who made a wada, best points first, then
 * name order. The display name comes from the caller-supplied
 * customer list; a customer with no display record is shown by
 * their recorded key, never dropped.
 */
export function wadaDashboardCustomers(list, customers) {
  const records = normalizeWadaDashboardList(list);
  const keyByLower = new Map();
  for (const record of records) {
    const lower = cleanKey(record.customer);
    if (!keyByLower.has(lower)) keyByLower.set(lower, cleanText(record.customer));
  }
  const rows = [...keyByLower.values()].map((key) => {
    const stats = wadaDashboardCustomerStats(records, key);
    return { ...stats, name: displayNameFor(customers, key) };
  });
  rows.sort((a, b) => {
    if (a.points !== b.points) return b.points - a.points;
    const nameA = cleanKey(a.name);
    const nameB = cleanKey(b.name);
    if (nameA !== nameB) return nameA < nameB ? -1 : 1;
    return cleanKey(a.customer) < cleanKey(b.customer) ? -1 : 1;
  });
  return rows;
}

/**
 * Search dashboard rows by customer name (or recorded key):
 * case-insensitive substring. A blank search returns every row.
 */
export function wadaDashboardSearchRows(rows, query) {
  const wanted = cleanKey(query);
  const base = Array.isArray(rows) ? rows : [];
  if (!wanted) return [...base];
  return base.filter((row) => cleanKey(row.name).includes(wanted)
    || cleanKey(row.customer).includes(wanted));
}

/** Plain-words summary of the dashboard totals. */
export function wadaDashboardSummaryText(totals) {
  const base = totals && typeof totals === 'object' ? totals : wadaDashboardTotals([]);
  if (!base.total) return 'No wadas recorded yet.';
  const customerWord = base.customers === 1 ? 'customer' : 'customers';
  const wadaWord = base.total === 1 ? 'wada' : 'wadas';
  return `${base.customers} ${customerWord} made ${base.total} ${wadaWord}: `
    + `${base.kept} kept on time, ${base.keptLate} kept late, `
    + `${base.broken} broken, ${base.pending} still open. `
    + `Kept: ${base.keptPercent}% · Broken: ${base.brokenPercent}%.`;
}

/** Plain-words line for one customer's row. */
export function wadaDashboardCustomerText(row) {
  if (!row || typeof row !== 'object') return '';
  const name = cleanText(row.name) || cleanText(row.customer) || 'Customer';
  if (!row.total) return `${name} — no wadas recorded.`;
  const counts = `${row.kept} kept on time · ${row.keptLate} kept late · ${row.broken} broken · ${row.pending} still open`;
  if (row.trusted) return `${name} — ${counts}. Points: ${row.points}. Trusted — keeps wadas.`;
  if (row.chancePercent === null || row.chancePercent === undefined) {
    return `${name} — ${counts}. Points: ${row.points}. No closed wadas yet — no history to rate.`;
  }
  return `${name} — ${counts}. Points: ${row.points}. ${row.chancePercent}% chance to keep a wada, from history.`;
}

function wadaDashboardPieHtml(slices, total) {
  if (!total) return '<p>No wadas recorded yet — the pie chart appears once a wada is recorded.</p>';
  let at = 0;
  const stops = slices.map((slice) => {
    const from = at;
    at += slice.share;
    return `${slice.color} ${from}% ${at}%`;
  }).join(', ');
  const legend = slices.map((slice) => `<li><span style="display:inline-block;width:12px;height:12px;background:${slice.color};border-radius:2px;"></span> ${escapeHtml(slice.label)} — ${slice.count} (${slice.share}%)</li>`).join('');
  return `<div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap;"><div role="img" aria-label="Wada pie chart: ${escapeHtml(slices.map((slice) => `${slice.label} ${slice.share}%`).join(', '))}" style="width:140px;height:140px;border-radius:50%;background:conic-gradient(${stops});flex:none;"></div><ul style="list-style:none;margin:0;padding:0;font-size:13px;line-height:1.9;">${legend}</ul></div>`;
}

/**
 * The dashboard: totals, pie chart, and the per-customer list.
 * Trusted customers show green; below 100 points the row shows
 * red with the history chance. Rows are already filtered by the
 * caller; the pie always covers every counted wada.
 */
export function wadaDashboardHtml(totals, rows) {
  const base = totals && typeof totals === 'object' ? totals : wadaDashboardTotals([]);
  const shares = Number.isFinite(base.keptShare) && Number.isFinite(base.brokenShare)
    ? [base.keptShare, base.keptLateShare, base.brokenShare, base.pendingShare]
    : reconciledShares([base.kept || 0, base.keptLate || 0, base.broken || 0, base.pending || 0], base.total || 0);
  const pieSlices = [
    { key: 'kept', label: 'Kept on time', color: '#16a34a', count: base.kept || 0, share: shares[0] },
    { key: 'keptLate', label: 'Kept late', color: '#d97706', count: base.keptLate || 0, share: shares[1] },
    { key: 'broken', label: 'Broken', color: '#dc2626', count: base.broken || 0, share: shares[2] },
    { key: 'pending', label: 'Still open', color: '#94a3b8', count: base.pending || 0, share: shares[3] }
  ];
  const list = Array.isArray(rows) ? rows : [];
  const rowsHtml = list.length
    ? `<ul style="list-style:none;margin:8px 0 0;padding:0;">${list.map((row) => {
      const counts = `${row.kept} kept on time · ${row.keptLate} kept late · ${row.broken} broken · ${row.pending} still open. Points: ${row.points}.`;
      const status = row.trusted
        ? '<span style="color:#15803d;font-weight:700;">Trusted</span>'
        : row.chancePercent === null || row.chancePercent === undefined
          ? '<span style="color:#b91c1c;font-weight:700;">No history yet</span>'
          : `<span style="color:#b91c1c;font-weight:700;">${row.chancePercent}% chance to keep a wada</span>`;
      return `<li style="padding:6px 0;border-top:1px solid #e2e8f0;"><strong>${escapeHtml(row.name || row.customer)}</strong> — ${escapeHtml(counts)} ${status}</li>`;
    }).join('')}</ul>`
    : '<p>No customers match this search.</p>';
  return `<p>${escapeHtml(wadaDashboardSummaryText(base))}</p>`
    + `<h4>Wada pie chart</h4>${wadaDashboardPieHtml(pieSlices, base.total || 0)}`
    + `<h4>Customers by wada points</h4>${rowsHtml}`;
}

export function wadaDashboardCsv(rows) {
  const header = ['customer', 'name', 'kept_on_time', 'kept_late', 'broken', 'still_open', 'total', 'points', 'trusted', 'chance_percent'];
  const lines = [header.join(',')];
  for (const row of Array.isArray(rows) ? rows : []) {
    lines.push([
      row.customer,
      row.name,
      row.kept,
      row.keptLate,
      row.broken,
      row.pending,
      row.total,
      row.points,
      row.trusted ? 'yes' : 'no',
      row.chancePercent === null || row.chancePercent === undefined ? '' : String(row.chancePercent)
    ].map(csvCell).join(','));
  }
  return lines.join('\n');
}

export function wadaDashboardFilename() {
  return 'wada-dashboard.csv';
}
